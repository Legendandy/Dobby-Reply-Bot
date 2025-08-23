// Fixed Twitter Content Script - React-compatible version
console.log('🧙‍♂️ Dobby content script loaded!', new Date().toISOString());

class DobbyTwitter {
  constructor() {
    this.apiKey = null;
    this.observer = null;
    this.backend_url = 'https://dobby-backend-five.vercel.app';
    this.typeDelayMs = 8;
    this.init();
  }

  async init() {
    await this.loadApiKey();
    this.startObserving();
    setTimeout(() => this.scanForReplyBoxes(), 2000);

    chrome.runtime.onMessage.addListener((request) => {
      if (request.action === 'apiKeyUpdated') {
        this.apiKey = request.apiKey;
        console.log('🔑 API key updated from popup');
        this.scanForReplyBoxes();
      }
    });
  }

  async loadApiKey() {
    try {
      const result = await chrome.storage.sync.get(['dobbyApiKey']);
      this.apiKey = result.dobbyApiKey;
      if (this.apiKey) console.log('✅ API key loaded from storage');
      else console.log('❌ No API key found - configure in popup first');
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              node.querySelector &&
              (node.querySelector('[data-testid*="tweet"]') ||
                node.querySelector('[contenteditable="true"]'))
            ) {
              shouldScan = true;
            }
          });
        }
      }
      if (shouldScan) setTimeout(() => this.scanForReplyBoxes(), 500);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  scanForReplyBoxes() {
    if (!this.apiKey) {
      console.log('⚠️ No API key available, skipping button injection');
      return;
    }

    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="tweetTextarea_1"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][data-testid*="tweet"]'
    ];

    let buttonsAdded = 0;
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((container) => {
        const editable = this.resolveEditable(container);
        if (editable && !editable.dobbyButtonAdded) {
          const tweetContent = this.extractTweetContent(editable);
          this.addDobbyButton(editable, tweetContent);
          buttonsAdded++;
        }
      });
    });

    if (buttonsAdded > 0) console.log(`✅ Added ${buttonsAdded} Dobby buttons`);
  }

  resolveEditable(node) {
    if (node && (node.isContentEditable || node.getAttribute('contenteditable') === 'true')) return node;
    return (
      node?.querySelector?.('div[role="textbox"][contenteditable="true"]') ||
      node?.querySelector?.('div[contenteditable="true"][data-testid*="tweet"]') ||
      (document.activeElement?.matches?.('div[role="textbox"][contenteditable="true"]') ? document.activeElement : null)
    );
  }

  addDobbyButton(editable, tweetContent) {
    editable.dobbyButtonAdded = true;
    const dobbyButton = this.createDobbyButton(editable, tweetContent);
    const buttonContainer = this.findButtonContainer(editable);
    if (buttonContainer) buttonContainer.appendChild(dobbyButton);
    else editable.parentElement?.appendChild(dobbyButton);
  }

  createDobbyButton(editable, tweetContent) {
    const button = document.createElement('button');
    button.className = 'dobby-button';
    button.innerHTML = 'Reply With Dobby';
    button.title = 'Generate AI reply with Dobby';
    button.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none; border-radius: 20px; color: white; cursor: pointer;
      font-size: 13px; font-weight: 600; margin: 0 8px; padding: 6px 12px;
      transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 1000; position: relative;`;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const liveEditable = this.resolveEditable(editable) || editable;
      this.handleDobbyClick(liveEditable, tweetContent, button);
    });

    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.background = 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)';
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
      }
    });
    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        button.style.transform = 'none';
        button.style.boxShadow = 'none';
      }
    });

    return button;
  }

  findButtonContainer(editable) {
    let current = editable.parentElement,
      attempts = 0;
    while (current && attempts < 10) {
      const toolbar =
        current.querySelector('[data-testid="toolBar"]') ||
        current.querySelector('[role="group"]');
      if (toolbar) return toolbar;
      current = current.parentElement;
      attempts++;
    }
    return null;
  }

  extractTweetContent(editable) {
    const mainTweet = this.findMainTweet(editable);
    if (mainTweet) return mainTweet;
    const directReplyTweet = this.findDirectReplyTarget(editable);
    if (directReplyTweet) return directReplyTweet;
    const anyTweetContent = this.findAnyTweetContent();
    if (anyTweetContent) return anyTweetContent;
    return 'Generate an engaging and thoughtful reply to this conversation';
  }

  findMainTweet(editable) {
    for (let article of document.querySelectorAll('article[data-testid="tweet"]')) {
      if (article.contains(editable)) continue;
      const tweetText = article.querySelector('[data-testid="tweetText"]');
      if (tweetText && tweetText.textContent.trim()) {
        const text = tweetText.textContent.trim();
        if (!text.startsWith('Replying to') && !text.startsWith('@') && text.length > 10) return text;
      }
    }
    return null;
  }

  findDirectReplyTarget(editable) {
    let current = editable,
      attempts = 0;
    while (current && attempts < 20) {
      for (let tweetElement of current.querySelectorAll('[data-testid="tweetText"]')) {
        const text = tweetElement.textContent.trim();
        if (
          !text.startsWith('Replying to') &&
          !text.startsWith('Show this thread') &&
          text.length > 15 &&
          !text.includes('·')
        ) {
          return text;
        }
      }
      current = current.parentElement;
      attempts++;
    }
    return null;
  }

  findAnyTweetContent() {
    for (let tweetElement of document.querySelectorAll('[data-testid="tweetText"]')) {
      const text = tweetElement.textContent.trim();
      if (
        text.length > 20 &&
        !text.startsWith('Replying to') &&
        !text.startsWith('Show this thread') &&
        !text.includes('ago') &&
        !text.includes('·') &&
        !text.match(/^\d+[hms]$/)
      ) {
        return text;
      }
    }
    return null;
  }

  async handleDobbyClick(editable, tweetContent, button) {
    if (button.disabled) return;
    button.disabled = true;
    button.style.opacity = '0.7';
    button.innerHTML = '🔮 Typing...';

    try {
      const content = this.extractTweetContent(editable) || tweetContent;
      const reply = await this.generateReply(content);
      await this.typeReplyLikeHuman(editable, reply);
      button.innerHTML = '✨ Typed!';
      await this.updateStats();
      console.log('✅ Reply typed successfully');
    } catch (error) {
      console.error('❌ Error generating/typing reply:', error);
      button.innerHTML = '❌ Error';
      alert(
        error.message.includes('API')
          ? 'Error: Please check your Fireworks API key in the extension popup'
          : 'Error generating reply. Please try again.'
      );
    } finally {
      setTimeout(() => {
        button.innerHTML = 'Reply With Dobby';
        button.disabled = false;
        button.style.opacity = '1';
      }, 1500);
    }
  }

  async generateReply(tweetContent) {
    const response = await fetch(`${this.backend_url}/api/generate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweetContent, apiKey: this.apiKey })
    });
    if (!response.ok)
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Unknown API error');
    return (data.reply || '').trim().replace(/^['"]|['"]$/g, '').trim();
  }

  // FIXED: Direct React state manipulation approach
  async typeReplyLikeHuman(editable, text) {
    console.log('Starting to type:', text);
    
    // Temporarily disable event listeners to prevent duplication
    this.disableEventListeners(editable);
    
    try {
      // Method 1: Direct React state update
      await this.updateReactState(editable, text);
      
      // Method 2: Fallback - simulate paste event (most reliable)
      if (!this.verifyTextInsertion(editable, text)) {
        await this.simulatePasteEvent(editable, text);
      }
      
      // Method 3: Final fallback - execCommand with proper events
      if (!this.verifyTextInsertion(editable, text)) {
        await this.execCommandMethod(editable, text);
      }
      
    } finally {
      // Re-enable event listeners after a delay
      setTimeout(() => this.enableEventListeners(editable), 500);
    }
    
    console.log('✅ Typing completed');
  }

  disableEventListeners(editable) {
    // Store original event listeners
    editable._originalListeners = {};
    
    // Temporarily override addEventListener to capture and disable listeners
    const originalAddEventListener = editable.addEventListener;
    editable.addEventListener = function() {};
    
    // Mark as disabled
    editable._listenersDisabled = true;
  }

  enableEventListeners(editable) {
    if (editable._listenersDisabled) {
      delete editable._listenersDisabled;
      // Event listeners will naturally re-attach when Twitter re-renders
    }
  }

  async updateReactState(editable, text) {
    // Focus first
    editable.focus();
    await this.sleep(50);
    
    // Clear content
    this.selectAllContent(editable);
    
    // Find React instance and update state directly
    const reactFiber = this.findReactFiber(editable);
    if (reactFiber) {
      try {
        // Method 1: Direct state update
        let component = reactFiber;
        while (component) {
          if (component.stateNode && component.stateNode.setState) {
            // Found stateful component
            component.stateNode.setState({ value: text }, () => {
              console.log('React state updated');
            });
            break;
          }
          component = component.return;
        }
        
        // Method 2: Update memoizedState if available
        if (reactFiber.memoizedState) {
          reactFiber.memoizedState = text;
        }
        
        // Method 3: Trigger onChange with correct event structure
        if (reactFiber.memoizedProps && reactFiber.memoizedProps.onChange) {
          const syntheticEvent = {
            target: { value: text },
            currentTarget: { value: text },
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {}
          };
          reactFiber.memoizedProps.onChange(syntheticEvent);
        }
        
        return true;
      } catch (e) {
        console.warn('React state update failed:', e);
      }
    }
    return false;
  }

  async simulatePasteEvent(editable, text) {
    // Focus the editable
    editable.focus();
    await this.sleep(50);
    
    // Clear existing content
    this.selectAllContent(editable);
    
    // Create clipboard data
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    
    // Create and dispatch paste event
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: clipboardData
    });
    
    // Dispatch paste event
    const pasteResult = editable.dispatchEvent(pasteEvent);
    
    if (pasteResult) {
      // If paste event wasn't cancelled, manually insert text
      document.execCommand('insertText', false, text);
    }
    
    // Trigger input events
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
      data: text
    });
    editable.dispatchEvent(inputEvent);
    
    await this.sleep(100);
  }

  async execCommandMethod(editable, text) {
    // Focus and clear
    editable.focus();
    await this.sleep(50);
    
    // Select all existing content
    this.selectAllContent(editable);
    
    // Use execCommand to insert text (most compatible)
    const success = document.execCommand('insertText', false, text);
    
    if (!success) {
      // Fallback: direct DOM manipulation with events
      editable.textContent = text;
    }
    
    // Ensure cursor is at end
    this.setCursorAtEnd(editable);
    
    // Trigger comprehensive events
    const events = [
      new InputEvent('beforeinput', { 
        bubbles: true, 
        inputType: 'insertText', 
        data: text 
      }),
      new InputEvent('input', { 
        bubbles: true, 
        inputType: 'insertText', 
        data: text 
      }),
      new Event('change', { bubbles: true }),
      new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' })
    ];
    
    for (const event of events) {
      editable.dispatchEvent(event);
      await this.sleep(10);
    }
    
    // Force React update
    this.forceReactUpdate(editable);
  }

  findReactFiber(element) {
    const key = Object.keys(element).find(key => 
      key.startsWith('__reactFiber') || 
      key.startsWith('__reactInternalInstance')
    );
    return key ? element[key] : null;
  }

  forceReactUpdate(editable) {
    const fiber = this.findReactFiber(editable);
    if (!fiber) return;
    
    // Try multiple update methods
    let currentFiber = fiber;
    while (currentFiber) {
      // Method 1: forceUpdate on component instance
      if (currentFiber.stateNode && typeof currentFiber.stateNode.forceUpdate === 'function') {
        try {
          currentFiber.stateNode.forceUpdate();
          return;
        } catch (e) {
          console.warn('forceUpdate failed:', e);
        }
      }
      
      // Method 2: Direct fiber update
      if (currentFiber.updateQueue) {
        try {
          // Trigger a re-render by modifying the fiber
          currentFiber.lanes = 1;
          currentFiber.childLanes = 1;
        } catch (e) {
          console.warn('Fiber update failed:', e);
        }
      }
      
      currentFiber = currentFiber.return;
    }
  }

  verifyTextInsertion(editable, expectedText) {
    const actualText = editable.textContent || editable.innerText || '';
    return actualText.trim() === expectedText.trim();
  }

  selectAllContent(editable) {
    const range = document.createRange();
    range.selectNodeContents(editable);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  setCursorAtEnd(editable) {
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async updateStats() {
    try {
      const result = await chrome.storage.sync.get(['dobbyStats']);
      const stats = result.dobbyStats || { repliesGenerated: 0 };
      stats.repliesGenerated += 1;
      await chrome.storage.sync.set({ dobbyStats: stats });
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }
}

// Boot exactly once
(function bootDobby() {
  const boot = () => {
    if (!window.dobbyTwitterInstance) {
      window.dobbyTwitterInstance = new DobbyTwitter();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 3000);
})();