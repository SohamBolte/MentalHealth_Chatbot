let currentConversationId = null;
let currentPHQ9Answers = Array(9).fill(null);
let currentPHQ9Question = 0;

document.addEventListener('DOMContentLoaded', () => {
  // Chat modal elements
  const chatModal = document.getElementById('chat-modal');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-button');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatPHQBtn = document.getElementById('chat-phq-button');
  const closeChatBtn = document.getElementById('close-chat');
  
  // PHQ-9 modal elements
  const phqModal = document.getElementById('phq-modal');
  const phqQuestionsContainer = document.getElementById('phq-questions-container');
  const phqPrevBtn = document.getElementById('phq-prev');
  const phqNextBtn = document.getElementById('phq-next');
  const submitPHQBtn = document.getElementById('submit-phq');
  const closePHQBtn = document.getElementById('close-phq');
  
  // Results modal elements
  const phqResultsModal = document.getElementById('phq-results-modal');
  const phqScoreElement = document.getElementById('phq-score');
  const phqSeverityElement = document.getElementById('phq-severity');
  const phqSeverityBar = document.getElementById('phq-severity-bar');
  const phqRecommendationElement = document.getElementById('phq-recommendation');
  const continueChatBtn = document.getElementById('continue-chat');
  const closePHQResultsBtn = document.getElementById('close-phq-results');
  
  // Loading indicator
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // Open chat buttons
  const chatNavBtn = document.getElementById('chat-nav-button');
  const heroChatBtn = document.getElementById('hero-chat-button');

  // PHQ-9 questions
  const phq9Questions = [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading the newspaper or watching television",
    "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
    "Thoughts that you would be better off dead or of hurting yourself in some way"
  ];

  const phq9Options = [
    "Not at all (0 points)",
    "Several days (1 point)",
    "More than half the days (2 points)",
    "Nearly every day (3 points)"
  ];

  // Event listeners for opening chat
  chatNavBtn.addEventListener('click', openChat);
  heroChatBtn.addEventListener('click', openChat);
  
  // Event listeners for chat functionality
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatSendBtn.addEventListener('click', sendMessage);
  chatPHQBtn.addEventListener('click', startPHQ9Assessment);
  closeChatBtn.addEventListener('click', closeChat);
  
  // Event listeners for PHQ-9 assessment
  phqPrevBtn.addEventListener('click', prevPHQ9Question);
  phqNextBtn.addEventListener('click', nextPHQ9Question);
  submitPHQBtn.addEventListener('click', submitPHQ9Assessment);
  closePHQBtn.addEventListener('click', closePHQ9Modal);
  
  // Event listeners for results modal
  continueChatBtn.addEventListener('click', () => {
    phqResultsModal.classList.add('hidden');
    chatModal.classList.remove('hidden');
  });
  closePHQResultsBtn.addEventListener('click', () => {
    phqResultsModal.classList.add('hidden');
  });

  // Start a new conversation when page loads
  startNewConversation();

  function openChat() {
    chatModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    addMessage('Assistant', 'Hello! I\'m SereneMind, your mental wellness companion. How are you feeling today?', 'bot-message', 'justify-start');
    addMessage('Assistant', 'You can share your thoughts with me, or if you\'d like, we can start with a PHQ-9 assessment to check in on your mental wellbeing.', 'bot-message', 'justify-start');
    chatInput.focus();
  }

  function closeChat() {
    chatModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  async function startNewConversation() {
    try {
      loadingIndicator.classList.remove('hidden');
      const response = await fetch('/start_conversation', {
        method: 'POST'
      });
      const data = await response.json();
      currentConversationId = data.conversation_id;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      addMessage('Error', 'Failed to initialize chat. Please refresh the page.', 'bot-message', 'justify-start');
    } finally {
      loadingIndicator.classList.add('hidden');
    }
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage('You', message, 'user-message', 'justify-end');
    chatInput.value = '';
    chatInput.disabled = true;
    chatSendBtn.disabled = true;

    const loadingId = `loading-${Date.now()}`;
    addMessage('Assistant', 'Thinking...', 'bot-message', 'justify-start', loadingId);

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          conversation_id: currentConversationId
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      document.getElementById(loadingId)?.remove();

      const sentimentIcon = data.sentiment.is_negative ? '🔴' : '🟢';
      const sentimentText = data.sentiment.is_negative ?
        'I notice you might be feeling down. I\'m here to help.' :
        'Glad to hear you\'re doing well!';

      addMessage(
        'Assistant',
        `${data.response}\n\n${sentimentIcon} ${sentimentText}`,
        'bot-message',
        'justify-start'
      );

      // Update conversation ID in case it was generated server-side
      currentConversationId = data.conversation_id;

    } catch (error) {
      console.error('Error:', error);
      document.getElementById(loadingId)?.remove();
      addMessage(
        'Error',
        'Sorry, I encountered an issue. Please try again.',
        'bot-message',
        'justify-start'
      );
    } finally {
      chatInput.disabled = false;
      chatSendBtn.disabled = false;
      chatInput.focus();
    }
  }

  function addMessage(sender, text, messageClass, justify, id = '') {
    const messageDiv = document.createElement('div');
    messageDiv.id = id;
    messageDiv.className = `flex ${justify} mb-4 fade-in`;
    
    // Check if this is a bot message with sentiment analysis
    let messageContent = text;
    if (messageClass === 'bot-message' && text.includes('🟢') || text.includes('🔴')) {
        const parts = text.split('\n\n');
        messageContent = `
            <div>${parts[0]}</div>
            <div class="mt-2 text-sm flex items-center">
                ${parts[1].split(' ')[0]} 
                <span class="ml-2">${parts[1].split(' ').slice(1).join(' ')}</span>
            </div>
        `;
    }

    messageDiv.innerHTML = `
        <div class="${messageClass} p-3 max-w-xs md:max-w-md rounded-lg">
            <div class="font-medium text-sm mb-1">${sender}</div>
            <div class="whitespace-pre-wrap">${messageContent}</div>
        </div>
    `;
    
    chatMessagesContainer.appendChild(messageDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

  function startPHQ9Assessment() {
    currentPHQ9Question = 0;
    currentPHQ9Answers = Array(9).fill(null);
    renderPHQ9Question();
    phqModal.classList.remove('hidden');
    chatModal.classList.add('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function renderPHQ9Question() {
    phqQuestionsContainer.innerHTML = '';
    
    // Update progress steps
    document.querySelectorAll('.phq-step').forEach((step, index) => {
      step.classList.remove('active', 'completed');
      if (index === currentPHQ9Question) {
        step.classList.add('active');
      } else if (index < currentPHQ9Question) {
        step.classList.add('completed');
      }
    });

    // Show current question
    const questionDiv = document.createElement('div');
    questionDiv.className = 'bg-white bg-opacity-90 rounded-lg p-4 shadow-sm border border-white border-opacity-50';
    questionDiv.innerHTML = `
      <p class="font-medium text-gray-700 mb-2">${currentPHQ9Question + 1}. ${phq9Questions[currentPHQ9Question]}</p>
      <div class="space-y-3 mt-4">
        ${phq9Options.map((option, i) => `
          <label class="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50">
            <div class="custom-radio">
              <input type="radio" name="phq-answer" value="${i}" ${currentPHQ9Answers[currentPHQ9Question] === i ? 'checked' : ''}>
              <span class="checkmark"></span>
            </div>
            <span class="text-gray-700">${option}</span>
          </label>
        `).join('')}
      </div>
    `;
    
    phqQuestionsContainer.appendChild(questionDiv);

    // Update navigation buttons
    phqPrevBtn.classList.toggle('hidden', currentPHQ9Question === 0);
    phqNextBtn.classList.toggle('hidden', currentPHQ9Question === phq9Questions.length - 1);
    submitPHQBtn.classList.toggle('hidden', currentPHQ9Question !== phq9Questions.length - 1);
  }

  function prevPHQ9Question() {
    if (currentPHQ9Question > 0) {
      saveCurrentAnswer();
      currentPHQ9Question--;
      renderPHQ9Question();
    }
  }

  function nextPHQ9Question() {
    saveCurrentAnswer();
    if (currentPHQ9Question < phq9Questions.length - 1) {
      currentPHQ9Question++;
      renderPHQ9Question();
    }
  }

  function saveCurrentAnswer() {
    const selectedOption = document.querySelector('input[name="phq-answer"]:checked');
    if (selectedOption) {
      currentPHQ9Answers[currentPHQ9Question] = parseInt(selectedOption.value);
    }
  }

  async function submitPHQ9Assessment() {
    saveCurrentAnswer();
    
    // Check if all questions are answered
    if (currentPHQ9Answers.some(answer => answer === null)) {
        alert('Please answer all questions before submitting.');
        return;
    }

    loadingIndicator.classList.remove('hidden');
    phqModal.classList.add('hidden');

    try {
        console.log('Submitting answers:', currentPHQ9Answers); // Debug log
        
        const response = await fetch('http://localhost:8000/phq9/submit', {  // Full URL for clarity
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                answers: currentPHQ9Answers
            })
        });

        console.log('Response status:', response.status); // Debug log
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error response:', errorData); // Debug log
            throw new Error(errorData.detail || 'Failed to submit assessment');
        }

        const data = await response.json();
        console.log('Success response:', data); // Debug log
        showPHQ9Results(data);

    } catch (error) {
        console.error('Submission error:', error);
        alert(`Error: ${error.message}`);
    } finally {
        loadingIndicator.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
    }


    function showPHQ9Results(results) {
        phqScoreElement.textContent = results.score;
        phqSeverityElement.textContent = results.severity;
        
        // Set the severity bar width based on score (max 27)
        const percentage = Math.min(100, (results.score / 27) * 100);
        phqSeverityBar.style.width = `${percentage}%`;
        
        // Set appropriate color for severity bar
        if (results.severity === "minimal") {
            phqSeverityBar.className = 'h-full rounded-full bg-green-500';
        } else if (results.severity === "mild") {
            phqSeverityBar.className = 'h-full rounded-full bg-yellow-500';
        } else if (results.severity === "moderate") {
            phqSeverityBar.className = 'h-full rounded-full bg-orange-500';
        } else {
            phqSeverityBar.className = 'h-full rounded-full bg-red-500';
        }
        
        // Update recommendation text
        let recommendation = '';
        if (results.severity === "minimal") {
            recommendation = `
                <p class="mb-4">${results.recommendation}</p>
                <p>Consider maintaining healthy habits like regular exercise, good sleep, and social connections.</p>
            `;
        } else if (results.severity === "mild") {
            recommendation = `
                <p class="mb-4">${results.recommendation}</p>
                <p>You might find it helpful to talk with a trusted friend or consider speaking with a healthcare professional.</p>
            `;
        } else if (results.severity === "moderate") {
            recommendation = `
                <p class="mb-4">${results.recommendation}</p>
                <p>Consider reaching out to a mental health professional to discuss your results and explore treatment options.</p>
            `;
        } else {
            recommendation = `
                <p class="mb-4">${results.recommendation}</p>
                <p>Please consider contacting a mental health professional soon to discuss your symptoms and treatment options.</p>
                <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p class="font-medium text-red-700">If you're having thoughts of self-harm, please contact a crisis hotline immediately:</p>
                    <ul class="list-disc pl-5 mt-2 space-y-1">
                        <li>National Suicide Prevention Lifeline: <span class="font-medium">988</span></li>
                        <li>Crisis Text Line: Text <span class="font-medium">HOME</span> to <span class="font-medium">741741</span></li>
                    </ul>
                </div>
            `;
        }
        
        phqRecommendationElement.innerHTML = recommendation;
        phqResultsModal.classList.remove('hidden');
    }

  function closePHQ9Modal() {
    phqModal.classList.add('hidden');
    chatModal.classList.remove('hidden');
    document.body.classList.remove('overflow-hidden');
  }
});