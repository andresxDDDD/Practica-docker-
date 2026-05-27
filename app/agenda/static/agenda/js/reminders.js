(function () {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    var notified = JSON.parse(localStorage.getItem('agenda_notified') || '{}');
    var POLL_INTERVAL = 30000;
    var REMINDER_WINDOW = 10 * 60 * 1000;

    function updateCountdowns() {
        var cards = document.querySelectorAll('[data-event-id][data-start]');
        var now = new Date();

        cards.forEach(function (card) {
            var start = new Date(card.dataset.start);
            var diff = start - now;
            var countdownEl = card.querySelector('.event-countdown');
            var pastEl = card.querySelector('.event-past');

            if (diff < 0) {
                if (countdownEl) countdownEl.classList.add('hidden');
                if (pastEl) pastEl.classList.remove('hidden');
                return;
            }

            if (countdownEl) {
                countdownEl.classList.remove('hidden');
                if (diff < 3600000) {
                    var minutes = Math.ceil(diff / 60000);
                    countdownEl.textContent = 'en ' + minutes + ' min';
                    countdownEl.className = 'event-countdown text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700';
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
        });
    }

    function checkReminders() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        var cards = document.querySelectorAll('[data-event-id][data-start]');
        var now = new Date();

        cards.forEach(function (card) {
            var id = card.dataset.eventId;
            var start = new Date(card.dataset.start);
            var diff = start - now;

            if (diff > 0 && diff < REMINDER_WINDOW && !notified[id]) {
                var title = card.querySelector('h3');
                var eventName = title ? title.textContent.trim() : 'Evento';

                try {
                    var n = new Notification('🔔 Recordatorio', {
                        body: eventName + ' comienza en ' + Math.ceil(diff / 60000) + ' minutos',
                        icon: '/static/agenda/js/icon.png',
                    });
                    setTimeout(function () { n.close(); }, 8000);
                } catch (e) {}

                notified[id] = true;
                localStorage.setItem('agenda_notified', JSON.stringify(notified));
            }
        });
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

    updateCountdowns();
    checkReminders();
    setInterval(updateCountdowns, POLL_INTERVAL);
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
