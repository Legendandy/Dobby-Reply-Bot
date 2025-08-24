// Fixed Twitter Content Script - React-compatible version with improved toolbar positioning
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
    
    if (buttonContainer) {
      // Insert at the beginning of the toolbar for better visibility
      if (buttonContainer.firstChild) {
        buttonContainer.insertBefore(dobbyButton, buttonContainer.firstChild);
      } else {
        buttonContainer.appendChild(dobbyButton);
      }
    } else {
      // Fallback: create our own toolbar-like container
      this.createFallbackToolbar(editable, dobbyButton);
    }
  }

  createDobbyButton(editable, tweetContent) {
    const button = document.createElement('button');
    button.className = 'dobby-button';
    button.innerHTML = 'Generate reply with Dobby';
    button.title = 'Generate AI reply with Dobby';
    
    // Updated CSS to match extension theme - Clean white and blue, optimized for toolbar
    button.style.cssText = `
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border: 0 !important;
      border-radius: 8px;
      color: #ffffff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      margin: 0 4px 0 0;
      padding: 6px 12px;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 1000;
      position: relative;
      box-shadow: 0 1px 6px rgba(59, 130, 246, 0.2);
      text-transform: none;
      letter-spacing: 0.25px;
      min-height: 32px;
      max-height: 32px;
      overflow: hidden;
      white-space: nowrap;
      flex-shrink: 0;
      outline: none !important;
      box-sizing: border-box;
    `;

    // Hover effects matching extension theme
    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)';
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 2px 12px rgba(59, 130, 246, 0.3)';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.disabled) {
        button.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
        button.style.transform = 'translateY(0px)';
        button.style.boxShadow = '0 1px 6px rgba(59, 130, 246, 0.2)';
      }
    });

    // Click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const liveEditable = this.resolveEditable(editable) || editable;
      this.handleDobbyClick(liveEditable, tweetContent, button);
    });

    return button;
  }

  findButtonContainer(editable) {
    let current = editable.parentElement;
    let attempts = 0;
    
    // Enhanced toolbar detection for both free and premium accounts
    while (current && attempts < 15) {
      // Primary toolbar selectors (most common)
      const primaryToolbar = current.querySelector('[data-testid="toolBar"]');
      if (primaryToolbar) {
        console.log('✅ Found primary toolbar');
        return primaryToolbar;
      }
      
      // Secondary toolbar selectors
      const secondarySelectors = [
        '[role="group"]',
        '[data-testid="tweetButtonGroup"]',
        '.css-1dbjc4n[role="group"]',
        'div[role="group"][aria-label*="Tweet"]',
        'div[role="group"][aria-label*="Reply"]'
      ];
      
      for (const selector of secondarySelectors) {
        const toolbar = current.querySelector(selector);
        if (toolbar) {
          // Validate this is actually a toolbar with buttons
          const hasButtons = toolbar.querySelector('button') || 
                           toolbar.querySelector('[role="button"]') ||
                           toolbar.querySelector('[data-testid*="Button"]');
          if (hasButtons) {
            console.log(`✅ Found secondary toolbar with selector: ${selector}`);
            return toolbar;
          }
        }
      }
      
      // Look for toolbar-like containers (flex layouts with buttons)
      const flexContainers = current.querySelectorAll('div[style*="flex"], .css-1dbjc4n');
      for (const container of flexContainers) {
        const buttonCount = container.querySelectorAll('button, [role="button"]').length;
        if (buttonCount >= 2 && buttonCount <= 6) {
          // Likely a toolbar
          const rect = container.getBoundingClientRect();
          if (rect.width > 100 && rect.height < 80) {
            console.log('✅ Found flex toolbar container');
            return container;
          }
        }
      }
      
      current = current.parentElement;
      attempts++;
    }
    
    // Fallback: look for any container with multiple buttons near the editable
    const nearbyButtons = editable.parentElement?.parentElement?.querySelectorAll('button, [role="button"]');
    if (nearbyButtons && nearbyButtons.length >= 2) {
      const buttonParent = nearbyButtons[0].parentElement;
      if (buttonParent) {
        console.log('✅ Found fallback button container');
        return buttonParent;
      }
    }
    
    console.log('⚠️ No toolbar found, will use fallback');
    return null;
  }

  createFallbackToolbar(editable, dobbyButton) {
    // Create a toolbar-like container as fallback
    const fallbackToolbar = document.createElement('div');
    fallbackToolbar.className = 'dobby-fallback-toolbar';
    fallbackToolbar.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 8px 0;
      margin-top: 8px;
      gap: 8px;
    `;
    
    fallbackToolbar.appendChild(dobbyButton);
    
    // Insert after the editable element's container
    let insertTarget = editable.parentElement;
    let attempts = 0;
    
    // Find a good insertion point
    while (insertTarget && attempts < 10) {
      if (insertTarget.nextSibling) {
        insertTarget.parentElement.insertBefore(fallbackToolbar, insertTarget.nextSibling);
        console.log('✅ Created fallback toolbar');
        return;
      }
      insertTarget = insertTarget.parentElement;
      attempts++;
    }
    
    // Last resort: append to the parent
    if (editable.parentElement) {
      editable.parentElement.appendChild(fallbackToolbar);
      console.log('✅ Created fallback toolbar (last resort)');
    }
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
      if (tweetText) {
        const cleanText = this.extractCleanText(tweetText);
        if (cleanText && !cleanText.startsWith('Replying to') && !cleanText.startsWith('@') && cleanText.length > 10) {
          return cleanText;
        }
      }
    }
    return null;
  }

  findDirectReplyTarget(editable) {
    let current = editable,
      attempts = 0;
    while (current && attempts < 20) {
      for (let tweetElement of current.querySelectorAll('[data-testid="tweetText"]')) {
        const cleanText = this.extractCleanText(tweetElement);
        if (
          cleanText &&
          !cleanText.startsWith('Replying to') &&
          !cleanText.startsWith('Show this thread') &&
          cleanText.length > 15 &&
          !cleanText.includes('·')
        ) {
          return cleanText;
        }
      }
      current = current.parentElement;
      attempts++;
    }
    return null;
  }

  findAnyTweetContent() {
    for (let tweetElement of document.querySelectorAll('[data-testid="tweetText"]')) {
      const cleanText = this.extractCleanText(tweetElement);
      if (
        cleanText &&
        cleanText.length > 20 &&
        !cleanText.startsWith('Replying to') &&
        !cleanText.startsWith('Show this thread') &&
        !cleanText.includes('ago') &&
        !cleanText.includes('·') &&
        !cleanText.match(/^\d+[hms]$/)
      ) {
        return cleanText;
      }
    }
    return null;
  }

  // NEW: Extract only text content, ignore images, links, and media
  extractCleanText(tweetElement) {
    if (!tweetElement) return null;
    
    // Clone the element so we don't modify the original
    const clone = tweetElement.cloneNode(true);
    
    // Remove all image-related elements
    const imagesToRemove = [
      'img',                                    // Direct images
      '[data-testid="tweetPhoto"]',            // Tweet photos
      '[data-testid="card.layoutLarge.media"]', // Card media
      '[data-testid="card.layoutSmall.media"]', // Small card media
      '[role="img"]',                          // Icon images
      '.r-1p0dtai',                           // Twitter image classes
      '.r-1niwhzg',                           // More Twitter image classes
      'svg',                                   // SVG icons
      '[aria-label*="Image"]',                // Elements with image aria-labels
      '[alt]'                                 // Elements with alt text (likely images)
    ];
    
    imagesToRemove.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Remove link URLs but keep link text
    clone.querySelectorAll('a').forEach(link => {
      const linkText = link.textContent.trim();
      // If it's just a URL, remove it entirely
      if (this.isUrl(linkText)) {
        link.remove();
      } else {
        // Keep the text but remove the link wrapper
        const textNode = document.createTextNode(linkText);
        link.parentNode.replaceChild(textNode, link);
      }
    });
    
    // Remove elements that typically contain media or URLs
    const mediaSelectors = [
      '[data-testid*="media"]',
      '[data-testid*="video"]',
      '[data-testid*="photo"]',
      '.css-1dbjc4n[style*="background-image"]', // Background image containers
      '[href*="pic.twitter.com"]',              // Twitter image links
      '[href*="t.co"]'                          // Shortened URLs
    ];
    
    mediaSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });
    
    // Get the cleaned text
    let cleanText = clone.textContent || clone.innerText || '';
    
    // Clean up the text
    cleanText = cleanText
      .trim()
      .replace(/\s+/g, ' ')                    // Replace multiple spaces with single space
      .replace(/pic\.twitter\.com\/\w+/g, '')  // Remove pic.twitter.com links
      .replace(/https?:\/\/t\.co\/\w+/g, '')   // Remove t.co links
      .replace(/https?:\/\/[^\s]+/g, '')       // Remove any other URLs
      .trim();
    
    // Return null if text is too short or only contains non-meaningful content
    if (cleanText.length < 3 || this.isOnlyUrlsOrMentions(cleanText)) {
      return null;
    }
    
    return cleanText;
  }
  
  // Helper: Check if string is a URL
  isUrl(str) {
    try {
      return str.match(/^https?:\/\//) || 
             str.match(/^www\./) || 
             str.match(/pic\.twitter\.com/) ||
             str.match(/t\.co\//) ||
             str.includes('.com') ||
             str.includes('.org') ||
             str.includes('.net');
    } catch (e) {
      return false;
    }
  }
  
  // Helper: Check if text only contains URLs or mentions
  isOnlyUrlsOrMentions(text) {
    const words = text.split(/\s+/);
    const meaningfulWords = words.filter(word => {
      return !word.startsWith('@') && 
             !word.startsWith('#') && 
             !this.isUrl(word) &&
             word.length > 2;
    });
    return meaningfulWords.length === 0;
  }

  async handleDobbyClick(editable, tweetContent, button) {
    if (button.disabled) return;
    
    // Update button state with matching theme
    button.disabled = true;
    button.style.background = '#f3f4f6';
    button.style.color = '#6b7280';
    button.style.cursor = 'not-allowed';
    button.style.transform = 'none';
    button.style.boxShadow = 'none';
    button.innerHTML = '🔮 Generating...';

    try {
      const content = this.extractTweetContent(editable) || tweetContent;
      const reply = await this.generateReply(content);
      await this.typeReplyLikeHuman(editable, reply);
      
      // Success state
      button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      button.style.color = '#ffffff';
      button.innerHTML = '✅ Reply Generated!';
      
      await this.updateStats();
      console.log('✅ Reply typed successfully');
    } catch (error) {
      console.error('❌ Error generating/typing reply:', error);
      
      // Error state
      button.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      button.style.color = '#ffffff';
      button.innerHTML = '❌ Error';
      
      alert(
        error.message.includes('API')
          ? 'Error: Please check your Fireworks API key in the extension popup'
          : 'Error generating reply. Please try again.'
      );
    } finally {
      // Reset button after delay
      setTimeout(() => {
        button.innerHTML = 'Generate reply with Dobby';
        button.disabled = false;
        button.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
        button.style.color = '#ffffff';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '0 1px 6px rgba(59, 130, 246, 0.2)';
      }, 2000);
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