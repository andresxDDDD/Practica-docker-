let recognition = null;
let isListening = false;
let finalText = '';
let shouldRestart = false;

const listenBtn = document.getElementById('voice-btn');
const transcriptDisplay = document.getElementById('transcript');
const voiceResult = document.getElementById('voice-result');

var isSupported = ('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window);
console.log('Web Speech API soportada:', isSupported);
if (window.SpeechRecognition) console.log('SpeechRecognition disponible');
if (window.webkitSpeechRecognition) console.log('webkitSpeechRecognition disponible');

if (!isSupported) {
    if (listenBtn) {
        listenBtn.disabled = true;
        listenBtn.textContent = 'Voz no soportada';
    }
} else {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function (event) {
        var interimText = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
            var result = event.results[i];
            if (result.isFinal) {
                finalText += result[0].transcript + ' ';
                console.log('Final:', result[0].transcript);
            } else {
                interimText += result[0].transcript;
                console.log('Interim:', result[0].transcript);
            }
        }
        if (transcriptDisplay) {
            transcriptDisplay.textContent = finalText + interimText;
        }
    };

    recognition.onerror = function (event) {
        console.error('SpeechRecognition error:', event.error, event.message || '');
        isListening = false;
        shouldRestart = false;
        resetUI();
        var tip = '';
        if (event.error === 'not-allowed') {
            tip = 'Permiso de micrófono denegado. Revisa los permisos del navegador.';
        } else if (event.error === 'no-speech') {
            tip = 'No se detectó voz.';
        } else if (event.error === 'network') {
            tip = 'Error de red al conectar con el servicio de voz.';
        } else if (event.error === 'audio-capture') {
            tip = 'No se encontró micrófono.';
        } else if (event.error === 'service-not-allowed') {
            tip = 'Servicio de voz no permitido en este navegador.';
        } else if (event.error === 'aborted') {
            return;
        } else {
            tip = 'Error: ' + event.error;
        }
        showMessage(tip + ' Intenta de nuevo.', 'error');
    };

    recognition.onend = function () {
        console.log('Recognition ended, shouldRestart:', shouldRestart, 'isListening:', isListening, 'finalText:', finalText);
        if (shouldRestart) {
            try {
                recognition.start();
                console.log('Recognition restarted');
            } catch (e) {
                console.error('Failed to restart:', e);
            }
        } else {
            isListening = false;
            resetUI();
            if (finalText.trim()) {
                sendToServer(finalText.trim());
            }
        }
    };
}

function toggleListening() {
    console.log('toggleListening, current state - isListening:', isListening);
    if (isListening) {
        stopAndSend();
    } else {
        startListening();
    }
}

function startListening() {
    if (!recognition) {
        console.error('No recognition object available');
        return;
    }
    finalText = '';
    shouldRestart = true;
    isListening = true;
    if (transcriptDisplay) transcriptDisplay.textContent = '';
    listenBtn.classList.add('listening');
    listenBtn.innerHTML = '<span class="animate-pulse">●</span> Escuchando...';
    document.getElementById('listening-indicator')?.classList.remove('hidden');
    try {
        recognition.start();
        console.log('Recognition started');
    } catch (e) {
        console.error('Error starting recognition:', e);
    }
}

function stopAndSend() {
    console.log('stopAndSend called');
    shouldRestart = false;
    isListening = false;
    if (recognition) {
        try {
            recognition.stop();
            console.log('Recognition stopped gracefully');
        } catch (e) {
            console.error('Error stopping recognition:', e);
        }
    }
    var text = finalText.trim();
    if (text) {
        sendToServer(text);
    } else {
        resetUI();
    }
}

function resetUI() {
    listenBtn.classList.remove('listening');
    listenBtn.innerHTML = '🎤 Agregar por Voz';
    document.getElementById('listening-indicator')?.classList.add('hidden');
}

function sendToServer(text) {
    if (!text) return;

    console.log('Sending to server:', text);
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
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            console.log('Server response:', data);
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
        .catch(function (err) {
            console.error('Fetch error:', err);
            showMessage('Error de conexión: ' + err.message, 'error');
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
    el.textContent = msg;
    el.className = 'mt-4 p-3 rounded-lg text-sm font-medium ' +
        (type === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700');
    el.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 5000);
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
            if (e.key === 'Enter') {
                sendTextCommand();
            }
        });
    }
    var btn = document.getElementById('voice-btn');
    if (btn) {
        btn.addEventListener('click', toggleListening);
        console.log('Voice button listener attached');
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
