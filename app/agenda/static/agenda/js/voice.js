let recognition = null;
let isListening = false;
let finalText = '';
let silenceTimer = null;
const SILENCE_TIMEOUT = 5000;

const listenBtn = document.getElementById('voice-btn');
const transcriptDisplay = document.getElementById('transcript');
const voiceResult = document.getElementById('voice-result');

var isSupported = ('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window);

if (!isSupported) {
    if (listenBtn) {
        listenBtn.disabled = true;
        listenBtn.textContent = 'Voz no soportada';
    }
} else {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function createRecognition() {
        var sr = new SpeechRecognition();
        sr.lang = 'es-MX';
        sr.interimResults = true;
        sr.continuous = true;
        sr.maxAlternatives = 1;

        sr.onresult = function (event) {
            var interimText = '';
            for (var i = event.resultIndex; i < event.results.length; i++) {
                var result = event.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript + ' ';
                } else {
                    interimText += result[0].transcript;
                }
            }
            if (transcriptDisplay) {
                transcriptDisplay.textContent = finalText + interimText;
            }
            resetSilenceTimer();
        };

        sr.onerror = function (event) {
            if (event.error === 'not-allowed') {
                isListening = false;
                clearTimeout(silenceTimer);
                resetUI();
                showMessage('Permiso de micrófono denegado. Revisa los permisos del navegador.', 'error');
            } else if (event.error === 'network') {
                showMessage('Error de red al conectar con el servicio de voz.', 'error');
            } else if (event.error === 'audio-capture') {
                showMessage('No se encontró micrófono.', 'error');
            }
        };

        sr.onend = function () {
            if (isListening) {
                recognition = createRecognition();
                try { recognition.start(); } catch (e) {}
            }
        };

        return sr;
    }

    recognition = createRecognition();
}

function resetSilenceTimer() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(function () {
        if (isListening) {
            autoStopAndSend();
        }
    }, SILENCE_TIMEOUT);
}

function stopAndSend() {
    clearTimeout(silenceTimer);
    isListening = false;
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }
    var text = finalText.trim();
    if (text) {
        sendToServer(text);
    } else {
        resetUI();
    }
}

function autoStopAndSend() {
    isListening = false;
    if (recognition) {
        try { recognition.stop(); } catch (e) {}
    }
    resetUI();
    var text = finalText.trim();
    if (text) {
        sendToServer(text);
    }
}

function toggleListening() {
    if (isListening) {
        stopAndSend();
    } else {
        startListening();
    }
}

function startListening() {
    finalText = '';
    isListening = true;
    if (transcriptDisplay) transcriptDisplay.textContent = '';
    listenBtn.classList.add('listening');
    listenBtn.innerHTML = '<span class="animate-pulse">●</span> Escuchando...';
    document.getElementById('listening-indicator')?.classList.remove('hidden');
    showMessage('', '');
    try {
        recognition.start();
    } catch (e) {
        isListening = false;
        resetUI();
        showMessage('Error al iniciar el micrófono.', 'error');
    }
}

function resetUI() {
    listenBtn.classList.remove('listening');
    listenBtn.innerHTML = '🎤 Agregar por Voz';
    document.getElementById('listening-indicator')?.classList.add('hidden');
}

function sendToServer(text) {
    if (!text) return;
    if (transcriptDisplay) transcriptDisplay.textContent = 'Procesando...';

    fetch('/voice/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({ text: text }),
    })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(function (data) {
            if (data.error) {
                showMessage('Error: ' + data.error, 'error');
                if (transcriptDisplay) transcriptDisplay.textContent = '';
                return;
            }
            showMessage('Evento creado: ' + data.title, 'success');
            if (voiceResult) {
                voiceResult.innerHTML =
                    '<p class="font-semibold">' + data.title + '</p>' +
                    '<p class="text-sm opacity-75">' +
                    formatDate(data.start_datetime) +
                    '</p>';
            }
            if (transcriptDisplay) transcriptDisplay.textContent = '';
            setTimeout(function () { location.reload(); }, 1500);
        })
        .catch(function () {
            showMessage('Error de conexión con el servidor.', 'error');
            if (transcriptDisplay) transcriptDisplay.textContent = '';
        });
}

function formatDate(isoString) {
    var date = new Date(isoString);
    return date.toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function showMessage(msg, type) {
    var el = document.getElementById('voice-message');
    if (!el) return;
    if (!msg) { el.classList.add('hidden'); return; }
    el.textContent = msg;
    el.className = 'mt-4 p-3 rounded-lg text-sm font-medium ' +
        (type === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700');
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 8000);
}

function sendTextCommand() {
    var input = document.getElementById('text-command');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    sendToServer(text);
    input.value = '';
}

document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('text-command');
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') sendTextCommand();
        });
    }
    var btn = document.getElementById('voice-btn');
    if (btn) {
        btn.addEventListener('click', toggleListening);
    }
});

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
