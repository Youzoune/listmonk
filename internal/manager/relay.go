package manager

import (
	"math"
	"sync"
	"time"
)

// RelayLimits is the sending cadence of one relay (messenger): rates, the
// days and hours it may send, and its warm-up. Zero values mean no limit.
type RelayLimits struct {
	PerMinute int
	PerHour   int
	PerDay    int

	// Weekdays (0 = Sunday) the relay sends on. Empty means every day.
	Days []int

	// Sending hours, [FromHour, ToHour) in Location. 0 and 0 (or 24) mean all day.
	FromHour int
	ToHour   int

	Location *time.Location
	Warmup   Warmup
}

// Warmup ramps a new relay's daily volume up: Start messages on the first
// day, then Growth percent more every day, up to Cap.
type Warmup struct {
	Enabled bool
	Start   int
	Growth  float64
	Cap     int

	// Since is the relay's first sending day.
	Since time.Time
}

// RelayStatus is a snapshot of a relay's usage.
type RelayStatus struct {
	Name       string    `json:"name"`
	Day        string    `json:"day"`
	SentToday  int       `json:"sent_today"`
	LimitToday int       `json:"limit_today"` // 0 = no daily limit.
	WarmupDay  int       `json:"warmup_day"`  // 0 = no warm-up.
	WarmupDone int       `json:"warmup_done_day"`
	OpenNow    bool      `json:"open_now"`
	NextSendAt time.Time `json:"next_send_at"`
	HasCadence bool      `json:"has_cadence"`
}

// relayLimiter throttles the messages of one relay. Counters are per day, per
// hour and per minute slot in the relay's location; day counts are persisted
// by the manager so that a restart doesn't reset a warm-up day.
type relayLimiter struct {
	name string
	lim  RelayLimits

	mu        sync.Mutex
	day       string
	dayCount  int
	hourKey   int64
	hourCount int
	nextSlot  time.Time

	// Sends counted but not yet saved, per day.
	unsynced map[string]int
}

func newRelayLimiter(name string, lim RelayLimits) *relayLimiter {
	if lim.Location == nil {
		lim.Location = time.UTC
	}
	return &relayLimiter{name: name, lim: lim, unsynced: map[string]int{}}
}

// HasCadence tells whether the relay has any limit at all.
func (l RelayLimits) HasCadence() bool {
	return l.PerMinute > 0 || l.PerHour > 0 || l.PerDay > 0 || len(l.Days) > 0 ||
		l.windowed() || l.Warmup.Enabled
}

func (l RelayLimits) windowed() bool {
	return !(l.FromHour == 0 && (l.ToHour == 0 || l.ToHour >= 24))
}

// open tells whether t (in the relay's location) is inside the sending days and hours.
func (l RelayLimits) open(t time.Time) bool {
	if len(l.Days) > 0 {
		ok := false
		for _, d := range l.Days {
			if int(t.Weekday()) == d {
				ok = true
				break
			}
		}
		if !ok {
			return false
		}
	}
	if !l.windowed() {
		return true
	}
	return t.Hour() >= l.FromHour && t.Hour() < l.ToHour
}

// nextOpen returns the first instant at or after t when the relay may send.
// It returns the zero time if the relay never opens (no allowed day).
func (l RelayLimits) nextOpen(t time.Time) time.Time {
	t = t.In(l.Location)
	if l.open(t) {
		return t
	}

	// Walk forward hour by hour, from the start of the next hour.
	h := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, l.Location).Add(time.Hour)
	for range 24 * 8 {
		if l.open(h) {
			return h
		}
		h = h.Add(time.Hour)
	}
	return time.Time{}
}

// WarmupDay is the warm-up day number of t (1 on the Since day).
func (w Warmup) WarmupDay(t time.Time, loc *time.Location) int {
	s := w.Since.In(loc)
	t = t.In(loc)
	d0 := time.Date(s.Year(), s.Month(), s.Day(), 0, 0, 0, 0, loc)
	d1 := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
	return int(math.Round(d1.Sub(d0).Hours()/24)) + 1
}

// DayCap is the warm-up ceiling of a given day: Start × (1 + Growth)^(day − 1), up to Cap.
func (w Warmup) DayCap(day int) int {
	if day < 1 {
		return 0
	}
	v := int(math.Round(float64(w.Start) * math.Pow(1+w.Growth/100, float64(day-1))))
	if w.Cap > 0 && v > w.Cap {
		return w.Cap
	}
	return v
}

// DoneDay is the first day on which the warm-up reaches its ceiling, or 0
// if it never ramps.
func (w Warmup) DoneDay() int {
	if w.Start <= 0 || w.Growth <= 0 || w.Cap <= 0 {
		return 0
	}
	if w.Start >= w.Cap {
		return 1
	}
	return int(math.Ceil(math.Log(float64(w.Cap)/float64(w.Start))/math.Log(1+w.Growth/100))) + 1
}

// DailyLimit is the number of messages allowed on t's day, 0 meaning no limit.
func (l RelayLimits) DailyLimit(t time.Time) int {
	if !l.Warmup.Enabled {
		return l.PerDay
	}

	c := l.Warmup.DayCap(l.Warmup.WarmupDay(t, l.Location))
	if c == 0 {
		// Before the first day of the warm-up: nothing may be sent. -1
		// keeps "no messages" apart from "no limit" (0).
		return -1
	}
	if l.PerDay > 0 && l.PerDay < c {
		return l.PerDay
	}
	return c
}

// roll resets the day and hour counters when t is in a new day or hour.
func (r *relayLimiter) roll(t time.Time) {
	if d := t.Format(time.DateOnly); d != r.day {
		r.day = d
		r.dayCount = 0
	}
	if hk := t.Unix() / 3600; hk != r.hourKey {
		r.hourKey = hk
		r.hourCount = 0
	}
}

// reserve takes one message slot at now. When the relay can't send, it
// returns false and how long to wait before trying again.
func (r *relayLimiter) reserve(now time.Time) (bool, time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	t := now.In(r.lim.Location)
	r.roll(t)

	// Outside the sending days or hours.
	if !r.lim.open(t) {
		return false, r.waitUntil(now, r.lim.nextOpen(t))
	}

	// Daily limit (warm-up included) reached: wait for the next day that opens.
	if limit := r.lim.DailyLimit(t); limit != 0 && (limit < 0 || r.dayCount >= limit) {
		midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, r.lim.Location).AddDate(0, 0, 1)
		return false, r.waitUntil(now, r.lim.nextOpen(midnight))
	}

	// Hourly limit reached: wait for the next hour that opens.
	if r.lim.PerHour > 0 && r.hourCount >= r.lim.PerHour {
		next := time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, r.lim.Location).Add(time.Hour)
		return false, r.waitUntil(now, r.lim.nextOpen(next))
	}

	// Per-minute rate: messages are spaced evenly.
	if r.lim.PerMinute > 0 && now.Before(r.nextSlot) {
		return false, r.nextSlot.Sub(now)
	}

	r.count(t)
	if r.lim.PerMinute > 0 {
		gap := time.Minute / time.Duration(r.lim.PerMinute)
		if r.nextSlot.Before(now) {
			r.nextSlot = now
		}
		r.nextSlot = r.nextSlot.Add(gap)
	}

	return true, 0
}

// record counts a message sent outside of campaigns (transactional or
// notification), which isn't throttled but uses the relay's quota.
func (r *relayLimiter) record(now time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()

	t := now.In(r.lim.Location)
	r.roll(t)
	r.count(t)
}

func (r *relayLimiter) count(t time.Time) {
	r.dayCount++
	r.hourCount++
	r.unsynced[r.day]++
}

// load sets the day's count from the persisted usage.
func (r *relayLimiter) load(day string, sent int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.day == "" || r.day == day {
		r.day = day
		r.dayCount = sent + r.unsynced[day]
	}
}

// takeUnsynced returns and clears the counts not yet saved.
func (r *relayLimiter) takeUnsynced() map[string]int {
	r.mu.Lock()
	defer r.mu.Unlock()

	out := r.unsynced
	r.unsynced = map[string]int{}
	return out
}

// giveBack restores counts that couldn't be saved.
func (r *relayLimiter) giveBack(counts map[string]int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for d, n := range counts {
		r.unsynced[d] += n
	}
}

// status returns a snapshot of the relay at now.
func (r *relayLimiter) status(now time.Time) RelayStatus {
	r.mu.Lock()
	defer r.mu.Unlock()

	t := now.In(r.lim.Location)
	r.roll(t)

	s := RelayStatus{
		Name:       r.name,
		Day:        r.day,
		SentToday:  r.dayCount,
		LimitToday: max(r.lim.DailyLimit(t), 0),
		OpenNow:    r.lim.open(t),
		HasCadence: r.lim.HasCadence(),
		NextSendAt: now,
	}
	if limit := r.lim.DailyLimit(t); limit < 0 {
		// Warm-up not started yet: shown as a limit of 0 for today.
		s.LimitToday = 0
	}
	if r.lim.Warmup.Enabled {
		s.WarmupDay = r.lim.Warmup.WarmupDay(t, r.lim.Location)
		s.WarmupDone = r.lim.Warmup.DoneDay()
	}

	// When will the next campaign message be allowed? Peek without reserving.
	limit := r.lim.DailyLimit(t)
	switch {
	case !r.lim.open(t):
		s.NextSendAt = r.lim.nextOpen(t)
	case limit != 0 && (limit < 0 || r.dayCount >= limit):
		midnight := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, r.lim.Location).AddDate(0, 0, 1)
		s.NextSendAt = r.lim.nextOpen(midnight)
	case r.lim.PerHour > 0 && r.hourCount >= r.lim.PerHour:
		s.NextSendAt = r.lim.nextOpen(time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), 0, 0, 0, r.lim.Location).Add(time.Hour))
	case r.lim.PerMinute > 0 && now.Before(r.nextSlot):
		s.NextSendAt = r.nextSlot
	}

	return s
}

func (r *relayLimiter) waitUntil(now, at time.Time) time.Duration {
	if at.IsZero() {
		// Never opens (no allowed day): check again in an hour in case the
		// settings change.
		return time.Hour
	}
	return max(at.Sub(now), time.Second)
}
