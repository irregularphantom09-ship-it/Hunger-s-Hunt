const form = document.querySelector("#feedback-form");
const success = document.querySelector("#feedback-success");
const error = document.querySelector("#feedback-error");
const submitButton = document.querySelector("#feedback-submit");

function setFeedbackMessage(type, message) {
    if (type === 'error') {
        error.textContent = message;
        error.hidden = false;
        success.hidden = true;
    } else {
        error.hidden = true;
        success.querySelector('p').textContent = message;
        success.hidden = false;
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        name: document.querySelector("#feedback-name").value.trim(),
        email: document.querySelector("#feedback-email").value.trim(),
        type: document.querySelector("#feedback-type").value.trim(),
        message: document.querySelector("#feedback-message").value.trim()
    };

    if (!payload.type) {
        setFeedbackMessage('error', 'Please select a feedback type.');
        return;
    }

    if (!payload.message) {
        setFeedbackMessage('error', 'Please enter your message before submitting.');
        return;
    }

    if (payload.message.length < 10 || payload.message.length > 2000) {
        setFeedbackMessage('error', 'Feedback message must be between 10 and 2000 characters.');
        return;
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        setFeedbackMessage('error', 'Please enter a valid email address.');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    error.hidden = true;

    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Unable to send feedback right now.');
        }

        form.reset();
        form.style.display = 'none';
        setFeedbackMessage('success', 'Thanks for helping improve Hunger\'s Hunt!');
    } catch (errorMessage) {
        setFeedbackMessage('error', errorMessage.message || 'Unable to send feedback right now.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Feedback';
    }
});