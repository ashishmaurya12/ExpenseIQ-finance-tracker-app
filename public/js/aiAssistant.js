/**
 * ExpenseIQ — AI Financial Assistant Frontend Module
 * Dynamically injects AI Assistant Floating Button and Slide-Out Chat Drawer.
 */

let aiConversationHistory = [];
let isAiSending = false;

function initAiAssistant() {
  // Check if AI drawer is already injected
  if (document.getElementById('aiAssistantDrawer')) return;

  const aiDrawerHTML = `
    <!-- Floating AI Assistant Trigger Button -->
    <button class="ai-fab-btn" id="aiFabBtn" title="Ask ExpenseIQ AI Assistant">
      <span class="ai-fab-icon">🤖</span>
      <span class="ai-fab-text">AI Assistant</span>
    </button>

    <!-- AI Chat Slide-Out Drawer -->
    <div class="ai-drawer-overlay" id="aiDrawerOverlay"></div>
    <aside class="ai-drawer" id="aiAssistantDrawer">
      <!-- Drawer Header -->
      <div class="ai-drawer-header">
        <div class="ai-drawer-title-group">
          <div class="ai-drawer-avatar">🤖</div>
          <div>
            <div class="ai-drawer-title">
              <span>ExpenseIQ AI</span>
              <span class="ai-badge">PRO</span>
            </div>
            <div class="ai-drawer-subtitle">AI-generated insights based on your real ExpenseIQ data</div>
          </div>
        </div>
        <div class="ai-drawer-actions">
          <button class="ai-icon-btn" id="btnClearAiChat" title="Clear Chat History">🗑️</button>
          <button class="ai-icon-btn" id="btnCloseAiDrawer" title="Close AI Assistant">✕</button>
        </div>
      </div>

      <!-- Quick Prompt Chips -->
      <div class="ai-quick-prompts" id="aiQuickPrompts">
        <div class="ai-chip" data-prompt="Where am I overspending this month?">📉 Overspending</div>
        <div class="ai-chip" data-prompt="Compare this month with last month.">📊 MoM Comparison</div>
        <div class="ai-chip" data-prompt="How can I save more money?">💡 Save More</div>
        <div class="ai-chip" data-prompt="Am I exceeding any of my category budgets?">🎯 Budget Check</div>
        <div class="ai-chip" data-prompt="How close am I to achieving my active goals?">🏆 Goals Status</div>
      </div>

      <!-- Chat Messages Container -->
      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-welcome-card" id="aiWelcomeCard">
          <div class="ai-welcome-icon">💡</div>
          <h4>Hi! I'm your ExpenseIQ AI Assistant.</h4>
          <p>Ask me questions about your income, category spending, active budgets, or savings goals!</p>
        </div>
      </div>

      <!-- Typing / Loading Indicator -->
      <div class="ai-typing-indicator hidden" id="aiTypingIndicator">
        <div class="ai-typing-dots">
          <span></span><span></span><span></span>
        </div>
        <span class="ai-typing-text">ExpenseIQ AI is analyzing your financial context...</span>
      </div>

      <!-- Input Bar -->
      <div class="ai-drawer-input-container">
        <form id="aiChatForm" class="ai-input-form">
          <input 
            type="text" 
            id="aiInputMessage" 
            class="ai-input-field" 
            placeholder="Ask AI a question about your finances..." 
            maxlength="500"
            autocomplete="off"
            required
          />
          <button type="submit" class="ai-send-btn" id="btnSendAiMessage" title="Send Message">
            <span>Send</span>
            <span>➔</span>
          </button>
        </form>
        <div class="ai-disclaimer">
          ⚠️ AI answers are for informational guidance based on your ExpenseIQ context.
        </div>
      </div>
    </aside>
  `;

  document.body.insertAdjacentHTML('beforeend', aiDrawerHTML);

  // Bind Listeners
  const fabBtn = document.getElementById('aiFabBtn');
  const drawer = document.getElementById('aiAssistantDrawer');
  const overlay = document.getElementById('aiDrawerOverlay');
  const closeBtn = document.getElementById('btnCloseAiDrawer');
  const clearBtn = document.getElementById('btnClearAiChat');
  const chatForm = document.getElementById('aiChatForm');
  const inputField = document.getElementById('aiInputMessage');
  const quickPrompts = document.getElementById('aiQuickPrompts');

  const openDrawer = () => {
    drawer.classList.add('open');
    overlay.classList.add('open');
    inputField.focus();
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  };

  fabBtn.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  clearBtn.addEventListener('click', () => {
    aiConversationHistory = [];
    const container = document.getElementById('aiChatMessages');
    container.innerHTML = `
      <div class="ai-welcome-card">
        <div class="ai-welcome-icon">💡</div>
        <h4>Chat history cleared.</h4>
        <p>Ask a new question or pick a prompt below to analyze your finances.</p>
      </div>
    `;
  });

  // Quick prompt chip click handler
  quickPrompts.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-chip');
    if (!chip) return;
    const promptText = chip.dataset.prompt;
    if (promptText) {
      inputField.value = promptText;
      submitAiMessage(promptText);
    }
  });

  // Chat Form submission
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = inputField.value.trim();
    if (msg) {
      submitAiMessage(msg);
    }
  });
}

/**
 * Submit User Message to AI Endpoint
 */
async function submitAiMessage(userText) {
  if (isAiSending || !userText) return;

  const inputField = document.getElementById('aiInputMessage');
  const sendBtn = document.getElementById('btnSendAiMessage');
  const typingIndicator = document.getElementById('aiTypingIndicator');
  const welcomeCard = document.getElementById('aiWelcomeCard');

  if (welcomeCard) welcomeCard.remove();

  // Clear input & disable controls
  inputField.value = '';
  isAiSending = true;
  sendBtn.disabled = true;
  typingIndicator.classList.remove('hidden');

  // Render User Message Bubble
  appendChatMessage('user', userText);

  try {
    const response = await apiSendAiMessage(userText, aiConversationHistory);

    if (response && response.success && response.reply) {
      appendChatMessage('assistant', response.reply);

      // Keep conversation history capped to 10
      aiConversationHistory.push({ role: 'user', content: userText });
      aiConversationHistory.push({ role: 'assistant', content: response.reply });
      if (aiConversationHistory.length > 10) {
        aiConversationHistory = aiConversationHistory.slice(-10);
      }
    } else {
      appendChatMessage('assistant', response.message || 'AI assistant is temporarily unavailable.');
    }
  } catch (err) {
    appendChatMessage('assistant', err.message || 'AI assistant is temporarily unavailable. Your financial data remains safe in ExpenseIQ.');
  } finally {
    isAiSending = false;
    sendBtn.disabled = false;
    typingIndicator.classList.add('hidden');
    inputField.focus();
  }
}

/**
 * Safely append chat bubble without unsafe innerHTML
 */
function appendChatMessage(role, text) {
  const container = document.getElementById('aiChatMessages');
  if (!container) return;

  const messageRow = document.createElement('div');
  messageRow.className = `ai-msg-row ${role === 'user' ? 'user-row' : 'assistant-row'}`;

  const bubble = document.createElement('div');
  bubble.className = `ai-msg-bubble ${role === 'user' ? 'user-bubble' : 'assistant-bubble'}`;

  if (role === 'assistant') {
    const avatar = document.createElement('span');
    avatar.className = 'ai-msg-avatar';
    avatar.textContent = '🤖';
    messageRow.appendChild(avatar);
  }

  // Safe formatting: split lines & list items safely
  const formattedContainer = document.createElement('div');
  formattedContainer.className = 'ai-msg-content';

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const li = document.createElement('div');
      li.className = 'ai-list-item';
      li.textContent = '• ' + line.trim().replace(/^[-*]\s*/, '');
      formattedContainer.appendChild(li);
    } else {
      const p = document.createElement('div');
      p.textContent = line;
      if (index > 0 && line.trim() === '') {
        p.style.height = '6px';
      }
      formattedContainer.appendChild(p);
    }
  });

  bubble.appendChild(formattedContainer);
  messageRow.appendChild(bubble);
  container.appendChild(messageRow);

  // Scroll to bottom smoothly
  container.scrollTop = container.scrollHeight;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAiAssistant);
} else {
  initAiAssistant();
}
