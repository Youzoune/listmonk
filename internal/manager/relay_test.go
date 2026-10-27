package manager

import (
	"testing"
	"time"
)

var paris, _ = time.LoadLocation("Europe/Paris")

// Same relay as the front's sending tests (static/app/src/lib/sending.test.ts).
func sesLimits() RelayLimits {
	return RelayLimits{
		PerMinute: 2, PerHour: 60, PerDay: 400,
		Days: []int{1, 2, 3, 4, 5}, FromHour: 8, ToHour: 18,
		Location: paris,
		Warmup:   Warmup{Enabled: true, Start: 30, Growth: 15, Cap: 400, Since: time.Date(2026, 10, 16, 0, 0, 0, 0, paris)},
	}
}

// Tuesday 27 October 2026, 10:15 in Paris.
var tuesday = time.Date(2026, 10, 27, 10, 15, 0, 0, paris)

func TestWarmup(t *testing.T) {
	w := sesLimits().Warmup
	if d := w.WarmupDay(tuesday, paris); d != 12 {
		t.Fatalf("warm-up day = %d, want 12", d)
	}
	for day, want := range map[int]int{0: 0, 1: 30, 12: 140, 19: 371, 20: 400, 40: 400} {
		if got := w.DayCap(day); got != want {
			t.Errorf("DayCap(%d) = %d, want %d", day, got, want)
		}
	}
	if d := w.DoneDay(); d != 20 {
		t.Errorf("DoneDay = %d, want 20", d)
	}
	if d := (Warmup{Start: 30, Growth: 0, Cap: 400}).DoneDay(); d != 0 {
		t.Errorf("DoneDay without growth = %d, want 0", d)
	}
}

func TestDailyLimit(t *testing.T) {
	l := sesLimits()
	if got := l.DailyLimit(tuesday); got != 140 {
		t.Errorf("limit = %d, want 140 (warm-up)", got)
	}
	l.Warmup.Enabled = false
	if got := l.DailyLimit(tuesday); got != 400 {
		t.Errorf("limit without warm-up = %d, want 400", got)
	}

	// Before the warm-up starts, nothing may be sent.
	l = sesLimits()
	l.Warmup.Since = tuesday.AddDate(0, 0, 2)
	if got := l.DailyLimit(tuesday); got != -1 {
		t.Errorf("limit before warm-up = %d, want -1", got)
	}
}

func TestReserveSpacesMessagesEvenly(t *testing.T) {
	r := newRelayLimiter("ses", RelayLimits{PerMinute: 2, Location: paris})

	if ok, _ := r.reserve(tuesday); !ok {
		t.Fatal("first message refused")
	}
	ok, wait := r.reserve(tuesday.Add(10 * time.Second))
	if ok || wait != 20*time.Second {
		t.Fatalf("second message: ok=%v wait=%v, want refused for 20s", ok, wait)
	}
	if ok, _ := r.reserve(tuesday.Add(30 * time.Second)); !ok {
		t.Fatal("message 30s later refused")
	}
}

func TestReserveHonoursHourAndDayLimits(t *testing.T) {
	r := newRelayLimiter("h", RelayLimits{PerHour: 2, PerDay: 3, Location: paris})
	now := tuesday

	for i := range 2 {
		if ok, _ := r.reserve(now); !ok {
			t.Fatalf("message %d refused", i)
		}
	}
	ok, wait := r.reserve(now)
	if ok || wait != 45*time.Minute {
		t.Fatalf("third message in the hour: ok=%v wait=%v, want 45m", ok, wait)
	}

	// Next hour: one more, then the day is full until midnight.
	now = tuesday.Add(45 * time.Minute)
	if ok, _ := r.reserve(now); !ok {
		t.Fatal("message in the next hour refused")
	}
	ok, wait = r.reserve(now.Add(time.Minute))
	midnight := time.Date(2026, 10, 28, 0, 0, 0, 0, paris)
	if ok || wait != midnight.Sub(now.Add(time.Minute)) {
		t.Fatalf("day full: ok=%v wait=%v, want until midnight", ok, wait)
	}

	// A new day resets the counters.
	if ok, _ := r.reserve(midnight.Add(time.Second)); !ok {
		t.Fatal("message on the next day refused")
	}
}

func TestReserveWaitsForTheSendingWindow(t *testing.T) {
	l := sesLimits()
	l.Warmup.Enabled = false
	r := newRelayLimiter("ses", l)

	// Friday 19:30: the next opening is Monday 8:00.
	friday := time.Date(2026, 10, 30, 19, 30, 0, 0, paris)
	ok, wait := r.reserve(friday)
	monday := time.Date(2026, 11, 2, 8, 0, 0, 0, paris)
	if ok || wait != monday.Sub(friday) {
		t.Fatalf("outside window: ok=%v wait=%v, want %v", ok, wait, monday.Sub(friday))
	}

	if ok, _ := r.reserve(monday); !ok {
		t.Fatal("message at opening refused")
	}
}

func TestWarmupQuotaCarriesOverToTheNextDay(t *testing.T) {
	l := sesLimits()
	l.PerMinute, l.PerHour = 0, 0
	r := newRelayLimiter("ses", l)
	r.load(tuesday.Format(time.DateOnly), 74)

	sent := 0
	for {
		ok, wait := r.reserve(tuesday)
		if !ok {
			// 140 allowed on day 12: wait for Wednesday 8:00.
			want := time.Date(2026, 10, 28, 8, 0, 0, 0, paris).Sub(tuesday)
			if wait != want {
				t.Fatalf("wait = %v, want %v", wait, want)
			}
			break
		}
		sent++
	}
	if sent != 66 {
		t.Fatalf("sent %d more today, want 66", sent)
	}

	// Wednesday is day 13: 161 messages.
	wed := time.Date(2026, 10, 28, 9, 0, 0, 0, paris)
	n := 0
	for {
		if ok, _ := r.reserve(wed); !ok {
			break
		}
		n++
	}
	if n != 161 {
		t.Fatalf("sent %d on day 13, want 161", n)
	}
}

func TestRecordAndUnsyncedCounts(t *testing.T) {
	r := newRelayLimiter("tx", RelayLimits{PerDay: 1, Location: paris})
	r.record(tuesday)
	r.record(tuesday)

	// Recorded messages use the quota even beyond the limit.
	if ok, _ := r.reserve(tuesday); ok {
		t.Fatal("campaign message allowed beyond the daily limit")
	}

	got := r.takeUnsynced()
	if got["2026-10-27"] != 2 {
		t.Fatalf("unsynced = %v, want 2 on 2026-10-27", got)
	}
	if len(r.takeUnsynced()) != 0 {
		t.Fatal("unsynced counts not cleared")
	}

	r.giveBack(got)
	if r.takeUnsynced()["2026-10-27"] != 2 {
		t.Fatal("counts not given back")
	}
}

func TestStatus(t *testing.T) {
	l := sesLimits()
	r := newRelayLimiter("ses", l)
	r.load("2026-10-27", 74)

	s := r.status(tuesday)
	if s.SentToday != 74 || s.LimitToday != 140 || s.WarmupDay != 12 || s.WarmupDone != 20 || !s.OpenNow || !s.HasCadence {
		t.Fatalf("unexpected status: %+v", s)
	}

	// No limits at all: the relay only counts.
	free := newRelayLimiter("pool", RelayLimits{})
	if st := free.status(tuesday); st.HasCadence || st.LimitToday != 0 {
		t.Fatalf("relay without cadence: %+v", st)
	}
}
