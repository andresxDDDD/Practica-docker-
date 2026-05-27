(function () {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    var NOTIFY_VERSION = '3';
    if (localStorage.getItem('agenda_notified_v') !== NOTIFY_VERSION) {
        localStorage.removeItem('agenda_notified');
        localStorage.setItem('agenda_notified_v', NOTIFY_VERSION);
    }
    var notified = JSON.parse(localStorage.getItem('agenda_notified') || '{}');
    var POLL_INTERVAL = 10000;
    var REMINDER_BEFORE = 10 * 60 * 1000;
    var REMINDER_AFTER = 5 * 60 * 1000;

    var audioCtx = null;
    function resumeAudio() {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }
    document.addEventListener('click', resumeAudio, { once: true });
    document.addEventListener('touchstart', resumeAudio, { once: true });
    function playAlarm() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            var now = audioCtx.currentTime;
            for (var i = 0; i < 6; i++) {
                var osc = audioCtx.createOscillator();
                var gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'square';
                osc.frequency.value = i % 2 === 0 ? 880 : 660;
                gain.gain.setValueAtTime(0.4, now + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.12);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.12);
            }
        } catch (e) {}
    }

    function showAlert(eventName, diff) {
        var msg = diff > 0
            ? '🔔 ' + eventName + ' comienza en ' + Math.ceil(diff / 60000) + ' minutos'
            : '🔔 ' + eventName + ' — ¡YA debería estar empezando!';

        playAlarm();
        playAlarm();

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                var n = new Notification('⏰ Recordatorio: ' + eventName, { body: msg });
                setTimeout(function () { n.close(); }, 10000);
            } catch (e) {}
        }

        setTimeout(function () { alert(msg); }, 500);
    }

    function updateCards() {
        var cards = document.querySelectorAll('[data-event-id][data-start]');
        var now = new Date();
        var hasDue = false;

        cards.forEach(function (card) {
            var start = new Date(card.dataset.start);
            var diff = start - now;
            var countdownEl = card.querySelector('.event-countdown');
            var pastEl = card.querySelector('.event-past');

            if (isNaN(start.getTime())) return;

            if (diff < -REMINDER_AFTER) {
                if (countdownEl) countdownEl.classList.add('hidden');
                if (pastEl) {
                    pastEl.classList.remove('hidden');
                    pastEl.textContent = 'Atrasado';
                }
                card.style.borderLeft = '4px solid #ef4444';
                return;
            }

            if (pastEl) pastEl.classList.add('hidden');
            card.style.borderLeft = '';

            if (diff < 0) {
                if (countdownEl) {
                    countdownEl.classList.remove('hidden');
                    countdownEl.textContent = '¡AHORA!';
                    countdownEl.className = 'event-countdown text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse';
                }
                card.style.borderLeft = '4px solid #f59e0b';
                hasDue = true;
                return;
            }

            if (countdownEl) {
                countdownEl.classList.remove('hidden');
                if (diff < 600000) {
                    var minutes = Math.ceil(diff / 60000);
                    countdownEl.textContent = 'en ' + minutes + ' min';
                    countdownEl.className = 'event-countdown text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700';
                } else if (diff < 86400000) {
                    var hours = Math.floor(diff / 3600000);
                    var mins = Math.floor((diff % 3600000) / 60000);
                    countdownEl.textContent = 'en ' + hours + 'h ' + mins + 'm';
                    countdownEl.className = 'event-countdown text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700';
                } else {
                    var days = Math.floor(diff / 86400000);
                    countdownEl.textContent = 'en ' + days + ' día' + (days > 1 ? 's' : '');
                    countdownEl.className = 'event-countdown text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600';
                }
            }
            if (diff < 3600000) hasDue = true;
        });

        var banner = document.getElementById('due-banner');
        if (banner) {
            if (hasDue) banner.classList.remove('hidden');
            else banner.classList.add('hidden');
        }
    }

    function checkReminders() {
        var cards = document.querySelectorAll('[data-event-id][data-start]');
        var now = new Date();

        cards.forEach(function (card) {
            var id = card.dataset.eventId;
            var start = new Date(card.dataset.start);
            if (isNaN(start.getTime())) return;
            var diff = start - now;
            var title = card.querySelector('h3');
            var eventName = title ? title.textContent.trim() : 'Evento';

            if (diff < -REMINDER_AFTER || diff > REMINDER_BEFORE) return;
            if (notified[id]) return;

            showAlert(eventName, diff);
            notified[id] = true;
            localStorage.setItem('agenda_notified', JSON.stringify(notified));
        });

        var activeIds = Array.from(document.querySelectorAll('[data-event-id]')).map(function (c) { return c.dataset.eventId; });
        var changed = false;
        Object.keys(notified).forEach(function (id) {
            if (activeIds.indexOf(id) === -1) {
                delete notified[id];
                changed = true;
            }
        });
        if (changed) localStorage.setItem('agenda_notified', JSON.stringify(notified));
    }

    function toggleComplete(eventId, btn) {
        fetch('/events/' + eventId + '/complete/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.completed) {
                    var card = btn.closest('[data-event-id]');
                    if (card) {
                        card.style.transition = 'opacity 0.3s';
                        card.style.opacity = '0';
                        setTimeout(function () {
                            card.remove();
                            if (!document.querySelector('[data-event-id]')) {
                                location.reload();
                            }
                        }, 300);
                    }
                } else {
                    location.reload();
                }
            })
            .catch(function () {});
    }

    window.toggleComplete = toggleComplete;

    updateCards();
    checkReminders();
    setInterval(updateCards, POLL_INTERVAL);
    setInterval(checkReminders, POLL_INTERVAL * 2);

    function getCSRFToken() {
        var input = document.querySelector('[name=csrfmiddlewaretoken]');
        if (input) return input.value;
        var name = 'csrftoken';
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var c = cookies[i].trim();
            if (c.indexOf(name + '=') === 0) {
                return c.substring(name.length + 1);
            }
        }
        return '';
    }
})();
