/**
 * ai-tutor.js — LaquTum AI Methodology Mentor & Doubts Solver
 * Powered by Google Vertex AI / Gemini
 */

const AITutor = (() => {
    let messages = []; // [{ role: 'user' | 'model', text: string, image?: string, timestamp: number }]
    let attachedImage = null; // { dataUrl: string, mimeType: string, base64: string, name: string }
    let isThinking = false;

    // Helper
    const $ = id => document.getElementById(id);

    /**
     * Open the AI Chat Screen
     */
    function openChat() {
        if (typeof PreviewApp !== 'undefined') {
            PreviewApp.showScreen('screen-ask');
            PreviewApp.wireAppBottomNav('ask');
        }

        const container = $('screen-ask');
        if (container) {
            renderChatUI();
        }
    }

    /**
     * Render the full ChatGPT / Gemini style Chat Interface
     */
    function renderChatUI() {
        const container = $('screen-ask');
        if (!container) return;

        container.innerHTML = `
            <div class="ai-chat-wrapper">
                <!-- Chat Top Header -->
                <div class="ai-chat-header">
                    <div class="ai-header-left">
                        <div class="ai-avatar-icon">✨</div>
                        <div class="ai-header-info">
                            <div class="ai-header-title">
                                <span>LaquTum AI</span>
                                <span class="ai-model-tag">Vertex AI</span>
                            </div>
                            <div class="ai-header-sub">
                                <span class="ai-status-dot"></span>
                                <span>The LaquTum Way of Learning • Universal Mentor</span>
                            </div>
                        </div>
                    </div>
                    <div class="ai-header-actions">
                        <button class="ai-action-btn" id="ai-btn-new-chat" title="Start New Chat">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                            <span class="btn-text-desktop">New Chat</span>
                        </button>
                    </div>
                </div>

                <!-- Chat Feed Messages Area -->
                <div class="ai-chat-messages" id="ai-chat-messages">
                    ${messages.length === 0 ? renderWelcomeHero() : renderMessageList()}
                </div>

                <!-- Chat Floating Bottom Input Area -->
                <div class="ai-input-bar-wrap">
                    <!-- Image Preview Chip (if photo attached) -->
                    <div class="ai-attached-preview ${attachedImage ? 'show' : ''}" id="ai-attached-preview">
                        ${attachedImage ? `
                            <div class="ai-preview-card">
                                <img src="${attachedImage.dataUrl}" alt="Attached question photo" class="ai-preview-thumb"/>
                                <span class="ai-preview-name">${escapeHTML(attachedImage.name)}</span>
                                <button type="button" class="ai-preview-remove" id="ai-btn-remove-photo" title="Remove photo">&times;</button>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Input Controls -->
                    <div class="ai-input-box">
                        <!-- Hidden Camera File Input -->
                        <input type="file" id="ai-camera-input" accept="image/*" style="display: none;" />

                        <!-- Camera / Photo Upload Button -->
                        <button type="button" class="ai-tool-btn" id="ai-btn-camera" title="Upload photo / Camera">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                                <circle cx="12" cy="13" r="3"/>
                            </svg>
                        </button>

                        <!-- Textarea Query Input -->
                        <textarea 
                            id="ai-query-input" 
                            class="ai-query-textarea" 
                            placeholder="Ask anything and learn the LaquTum way, or snap a photo of any question..." 
                            rows="1"
                        ></textarea>

                        <!-- Send Button -->
                        <button type="button" class="ai-send-btn" id="ai-btn-send" title="Send Question">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m5 12 14-7-7 14-2-5-5-2z"/>
                            </svg>
                        </button>
                    </div>

                    <div class="ai-input-footnote">
                        Powered by Google Vertex AI • The LaquTum Way of Learning
                    </div>
                </div>
            </div>
        `;

        attachEventListeners();
        scrollToBottom();
    }

    /**
     * Render the Welcome Hero with Quick Starter Prompt Chips
     */
    function renderWelcomeHero() {
        return `
            <div class="ai-welcome-hero">
                <div class="ai-welcome-badge">
                    <span>⚡ THE LAQUTUM WAY OF LEARNING</span>
                </div>
                <h2 class="ai-welcome-title">Learn Anything & Everything</h2>
                <p class="ai-welcome-desc">
                    Ask any concept, question, or upload a photo of your notes or problems. Learn it through the <strong>LaquTum Way of Learning</strong> — first-principles intuition, deep mental models, and instant 30-second clarity with zero rote memorization!
                </p>

                <!-- Starter Prompt Chips -->
                <div class="ai-starters-grid">
                    <button class="ai-starter-chip" data-prompt="Teach me how the LaquTum Way of Learning breaks down any complex subject from first principles.">
                        <span class="chip-icon">🧠</span>
                        <div class="chip-content">
                            <strong>First-Principles Mastery</strong>
                            <span>Break down any subject to foundational truth</span>
                        </div>
                    </button>

                    <button class="ai-starter-chip" data-prompt="Show me how the LaquTum Pattern Recognition framework lets me understand difficult concepts in 30 seconds.">
                        <span class="chip-icon">⚡</span>
                        <div class="chip-content">
                            <strong>30-Second Mental Clarity</strong>
                            <span>Grasp deep concepts without memorizing formulas</span>
                        </div>
                    </button>

                    <button class="ai-starter-chip" data-prompt="How do I spot hidden patterns across mathematics, logic, science, and real-world systems the LaquTum way?">
                        <span class="chip-icon">🔍</span>
                        <div class="chip-content">
                            <strong>Universal Pattern Recognition</strong>
                            <span>Connect invisible dots across diverse topics</span>
                        </div>
                    </button>

                    <button class="ai-starter-chip" data-prompt="Explain a tough, counter-intuitive idea to me using the 4-step LaquTum Way (Pattern, Shortcut, Intuition, Trap).">
                        <span class="chip-icon">🎯</span>
                        <div class="chip-content">
                            <strong>4-Step Mental Model</strong>
                            <span>Pattern • Shortcut • Deep Intuition • Traps</span>
                        </div>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render list of messages
     */
    function renderMessageList() {
        return messages.map((m, idx) => {
            const isUser = (m.role === 'user');
            return `
                <div class="ai-msg-row ${isUser ? 'user' : 'ai'}" data-index="${idx}">
                    ${!isUser ? `<div class="ai-msg-avatar">✨</div>` : ''}
                    <div class="ai-msg-bubble">
                        ${m.image ? `
                            <div class="ai-msg-image-wrap">
                                <img src="${m.image}" alt="Uploaded question" class="ai-msg-image" onclick="window.open(this.src)"/>
                            </div>
                        ` : ''}
                        <div class="ai-msg-text">${isUser ? escapeHTML(m.text).replace(/\n/g, '<br>') : formatMarkdown(m.text)}</div>
                        <div class="ai-msg-time">${formatTime(m.timestamp)}</div>
                    </div>
                    ${isUser ? `<div class="ai-msg-avatar user-avatar">👤</div>` : ''}
                </div>
            `;
        }).join('') + (isThinking ? renderThinkingIndicator() : '');
    }

    function renderThinkingIndicator() {
        return `
            <div class="ai-msg-row ai thinking" id="ai-thinking-row">
                <div class="ai-msg-avatar">✨</div>
                <div class="ai-msg-bubble thinking-bubble">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="thinking-text">Applying LaquTum Pattern Methodology...</span>
                </div>
            </div>
        `;
    }

    /**
     * Attach Event Listeners
     */
    function attachEventListeners() {
        const sendBtn = $('ai-btn-send');
        const textarea = $('ai-query-input');
        const cameraBtn = $('ai-btn-camera');
        const fileInput = $('ai-camera-input');
        const newChatBtn = $('ai-btn-new-chat');

        // New Chat
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => {
                if (messages.length > 0 && confirm('Start a fresh question thread?')) {
                    messages = [];
                    attachedImage = null;
                    renderChatUI();
                }
            });
        }

        // Camera / File Upload button
        if (cameraBtn && fileInput) {
            cameraBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) handleImageFile(file);
            });
        }

        // Remove photo button
        const removePhotoBtn = $('ai-btn-remove-photo');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => {
                attachedImage = null;
                const preview = $('ai-attached-preview');
                if (preview) preview.innerHTML = '';
            });
        }

        // Starter Prompt Chips
        document.querySelectorAll('.ai-starter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.getAttribute('data-prompt');
                if (prompt) {
                    if (textarea) textarea.value = prompt;
                    handleSend();
                }
            });
        });

        // Send Button
        if (sendBtn) {
            sendBtn.addEventListener('click', handleSend);
        }

        // Auto-resizing Textarea & Enter to Send
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
            });

            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            });

            // Clipboard Paste for Images
            textarea.addEventListener('paste', (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let item of items) {
                    if (item.type.indexOf('image') === 0) {
                        const file = item.getAsFile();
                        if (file) handleImageFile(file);
                    }
                }
            });
        }
    }

    /**
     * Process an image file uploaded by camera or picker
     */
    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const base64 = dataUrl.split(',')[1];
            attachedImage = {
                dataUrl: dataUrl,
                mimeType: file.type,
                base64: base64,
                name: file.name || 'Question_Photo.jpg'
            };

            const preview = $('ai-attached-preview');
            if (preview) {
                preview.classList.add('show');
                preview.innerHTML = `
                    <div class="ai-preview-card">
                        <img src="${dataUrl}" alt="Attached question photo" class="ai-preview-thumb"/>
                        <span class="ai-preview-name">${escapeHTML(attachedImage.name)}</span>
                        <button type="button" class="ai-preview-remove" id="ai-btn-remove-photo" title="Remove photo">&times;</button>
                    </div>
                `;
                const removeBtn = $('ai-btn-remove-photo');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        attachedImage = null;
                        preview.classList.remove('show');
                        preview.innerHTML = '';
                    });
                }
            }
        };
        reader.readAsDataURL(file);
    }

    /**
     * Send User Message
     */
    async function handleSend() {
        if (isThinking) return;
        const textarea = $('ai-query-input');
        const text = textarea ? textarea.value.trim() : '';

        if (!text && !attachedImage) {
            return;
        }

        const userMsg = {
            role: 'user',
            text: text,
            image: attachedImage ? attachedImage.dataUrl : null,
            timestamp: Date.now()
        };

        const imagePayload = attachedImage ? { ...attachedImage } : null;

        // Clear input state
        if (textarea) {
            textarea.value = '';
            textarea.style.height = 'auto';
        }
        attachedImage = null;
        const preview = $('ai-attached-preview');
        if (preview) {
            preview.classList.remove('show');
            preview.innerHTML = '';
        }

        messages.push(userMsg);
        isThinking = true;

        // Update messages feed
        updateFeedUI();

        try {
            const aiResponseText = await queryVertexAI(userMsg.text, imagePayload);
            messages.push({
                role: 'model',
                text: aiResponseText,
                timestamp: Date.now()
            });
        } catch (err) {
            console.error('[AITutor] Query error:', err);
            messages.push({
                role: 'model',
                text: `**⚠️ Unable to complete request**\n\n${err.message || 'Please check your internet connection or Google Vertex AI credentials in `ai-config.js`.'}`,
                timestamp: Date.now()
            });
        } finally {
            isThinking = false;
            updateFeedUI();
        }
    }

    /**
     * Query Vertex AI or Google Gemini API
     */
    async function queryVertexAI(userQuery, imageObj) {
        const config = (typeof window !== 'undefined' && window.VERTEX_AI_CONFIG) ? window.VERTEX_AI_CONFIG : null;
        const apiKey = config ? config.API_KEY : '';
        const accessToken = config ? config.ACCESS_TOKEN : '';
        const model = (config && config.MODEL) ? config.MODEL : 'gemini-1.5-flash';

        // IF CREDENTIALS ARE PROVIDED: Call live Google Gemini / Vertex AI Endpoint
        if (apiKey) {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            // Build parts
            const parts = [];
            if (imageObj && imageObj.base64) {
                parts.push({
                    inlineData: {
                        mimeType: imageObj.mimeType || 'image/jpeg',
                        data: imageObj.base64
                    }
                });
            }
            if (userQuery) {
                parts.push({ text: userQuery });
            } else if (imageObj) {
                parts.push({ text: 'Please extract the concept or question from this photo and break it down using the 4-step LaquTum Way of Learning.' });
            }

            // Build conversation history (up to last 6 messages)
            const contents = [];
            const recent = messages.slice(-7, -1);
            recent.forEach(m => {
                contents.push({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text }]
                });
            });
            contents.push({
                role: 'user',
                parts: parts
            });

            const body = {
                contents: contents,
                systemInstruction: {
                    parts: [{ text: config.SYSTEM_INSTRUCTION || 'Solve using LaquTum Pattern Methodology.' }]
                },
                generationConfig: {
                    temperature: config.TEMPERATURE || 0.2,
                    topP: config.TOP_P || 0.95,
                    maxOutputTokens: config.MAX_OUTPUT_TOKENS || 2048
                }
            };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const msg = (errData.error && errData.error.message) ? errData.error.message : `API request failed with status ${res.status}`;
                throw new Error(msg);
            }

            const data = await res.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
                return data.candidates[0].content.parts.map(p => p.text).join('\n');
            }
            throw new Error('No response generated by model.');
        }

        // IF ACCESS TOKEN / VERTEX REST ENDPOINT
        if (accessToken && config.PROJECT_ID) {
            const loc = config.LOCATION || 'us-central1';
            const endpoint = `https://${loc}-aiplatform.googleapis.com/v1/projects/${config.PROJECT_ID}/locations/${loc}/publishers/google/models/${model}:generateContent`;

            const parts = [];
            if (imageObj && imageObj.base64) {
                parts.push({
                    inlineData: {
                        mimeType: imageObj.mimeType || 'image/jpeg',
                        data: imageObj.base64
                    }
                });
            }
            if (userQuery) parts.push({ text: userQuery });

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: parts }]
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `Vertex AI call failed (${res.status})`);
            }
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        }

        // FALLBACK: INTELLIGENT SIMULATED METHODOLOGY ENGINE (Until user pastes API credentials)
        await new Promise(r => setTimeout(r, 1200)); // natural reading pause
        return generateMethodologyFallback(userQuery, imageObj);
    }

    /**
     * Fallback Pattern Engine demonstrating LaquTum Methodology
     * Shows a helpful note reminding the user to paste their Google Vertex AI API key in ai-config.js
     */
    function generateMethodologyFallback(query, imageObj) {
        const q = (query || '').toLowerCase();

        const banner = `> ℹ️ **Ready for Vertex AI**: To connect directly to your live Google Gemini / Vertex AI model, paste your API key in \`ai-config.js\` under \`API_KEY: '...'\`.\n\n`;

        // 1. First-Principles Mastery Prompt
        if (q.includes('first-principle') || q.includes('complex subject') || q.includes('foundational')) {
            return banner + `### 🧠 First-Principles Mastery — The LaquTum Way
The **LaquTum Way of Learning** begins with one simple truth: **Anything can be understood when you strip away memorized jargon and find the foundational physical invariant.**

---

### ⚡ The 30-Second Mental Model
1. **Deconstruct**: Ask: *"What is the one thing in this system that cannot change?"* (e.g., total energy in physics, relative gap in comparisons, conservation of flow in finance or systems).
2. **Remove the Middlemen**: Stop memorizing intermediate formulas created by textbooks.
3. **Anchor to Intuition**: Rebuild the entire concept upward using plain logic that a 10-year-old can follow.

---

### 🧠 Why This Works
Traditional education forces you to memorize hundreds of disconnected rules. The LaquTum Way shows you that **there are only a handful of core structures** repeated everywhere across mathematics, physics, logic, economics, and real-world systems.

### ⚠️ Trap to Avoid
Never accept a formula as a black box (e.g., *"just plug numbers into this formula"*). If you cannot explain *why* it works intuitively in 30 seconds, you haven't mastered it yet!`;
        }

        // 2. 30-Second Mental Clarity Prompt
        if (q.includes('30-second') || q.includes('mental clarity') || q.includes('difficult concepts')) {
            return banner + `### ⚡ The 30-Second Intuition Rule
How do top thinkers grasp complex ideas in seconds while others struggle for hours? They use **Pattern Anchoring**.

---

### ⚡ The LaquTum Shortcut Framework
- **Step 1: Identity Invariant**: Find what remains constant (Rate, Ratio, Total, or Boundary).
- **Step 2: Mental Ratio Scaling**: Instead of multi-digit arithmetic, scale values using simplified fractions (e.g., 20% = 1/5th, 12.5% = 1/8th).
- **Step 3: Direct Projection**: Project the answer directly from the ratio without setting up algebraic scratch sheets.

---

### 🧠 Why This Works
The human brain is wired for spatial, visual, and proportional relationships — not mechanical symbolic algebra. When you think in proportional patterns, calculations collapse from 3 minutes to **under 30 seconds**.

### ⚠️ Trap to Avoid
Do not rush to start writing equations before looking at the overarching structure. Spending 10 seconds to spot the pattern saves 2 minutes of calculation.`;
        }

        // 3. Universal Pattern Recognition Prompt
        if (q.includes('hidden pattern') || q.includes('universal pattern') || q.includes('connect invisible dots')) {
            return banner + `### 🔍 Universal Pattern Recognition
Across science, logic, mathematics, and engineering, the exact same underlying patterns wear different costumes:

---

### ⚡ The Cross-Domain Patterns
1. **The Invariant Balance**: What goes in must equal what comes out (Conservation of Mass, Kirchhoff's Laws, Double-Entry Accounting, Flow Invariants).
2. **The Constant Gap**: When two entities move or change together, their difference remains completely unchanged.
3. **Complementary Elimination**: When finding the direct answer requires checking 20 combinations, simply calculate the total minus the opposite!

---

### 🧠 Why This Works
Once you master a pattern in one domain, you instantly own it across every other domain without relearning it from scratch.

### ⚠️ Trap to Avoid
Assuming each new topic is a brand-new subject. It is almost always an old friend wearing a new disguise!`;
        }

        // 4. 4-Step Mental Model Prompt
        if (q.includes('4-step') || q.includes('counter-intuitive') || q.includes('mental model')) {
            return banner + `### 🎯 The 4-Step LaquTum Learning Framework
Every single question, doubt, or concept you ask is systematically broken down through these 4 pillars:

---

### ⚡ The 4 Pillars
1. **🎯 Identified Core Pattern**: Discover the deep structural blueprint behind the problem.
2. **⚡ The 30-Second Fast Shortcut**: The direct, elegant shortcut that solves it mentally with zero redundant steps.
3. **🧠 Deep First-Principles Intuition**: The "aha!" moment explaining *why* it works so the idea clicks forever.
4. **⚠️ Trap & Blindspot to Avoid**: The deceptive trap or common misconception that catches 90% of people off-guard.

---

### 🧠 Why This Works
This framework targets both the subconscious intuition (fast recognition) and analytical reasoning (bulletproof verification).

### ⚠️ Trap to Avoid
Solving without checking for traps. True mastery means knowing where the pitfall lies and walking cleanly around it.`;
        }

        // 5. Train / Rate Problem
        if (q.includes('train') || q.includes('platform') || q.includes('pole') || q.includes('speed')) {
            return banner + `### 🎯 Identified Pattern: **Rate × Time = Quantity**
A moving object passing a stationary point only covers its own length, but passing an extended body covers *(Object Length + Body Length)*.

---

### ⚡ The LaquTum Fast Shortcut (30 Seconds)
1. **Speed of Object**:
   $$Speed = \\frac{240\\text{ m}}{24\\text{ s}} = 10\\text{ m/s}$$
2. **Total Distance for Platform**:
   $$Total = 240\\text{ m} + 650\\text{ m} = 890\\text{ m}$$
3. **Time Required**:
   $$Time = \\frac{890}{10} = \\mathbf{89\\text{ seconds}}$$

---

### 🧠 Why This Works
Instead of setting up algebraic equations with velocity conversions, realize that every second the object advances exactly **10 meters**. To cover 890 meters, it takes \\(890 / 10 = 89\\) seconds immediately.

### ⚠️ Trap to Avoid
Many people calculate time only for the 650 m platform (\\(650/10 = 65\\) s) and pick option **65s**. Remember: it isn't clear of the platform until its very last point leaves!`;
        }

        // 6. Percentage / Proportions
        if (q.includes('percent') || q.includes('profit') || q.includes('loss') || q.includes('discount')) {
            return banner + `### 🎯 Identified Pattern: **Proportional Fractions**
Converting decimal percentages to irreducible fractions transforms tedious multiplication into simple division.

---

### ⚡ The LaquTum Fast Shortcut
- **12.5%** = \\(\\frac{1}{8}\\)
- **16.66%** = \\(\\frac{1}{6}\\)
- **20%** = \\(\\frac{1}{5}\\)
- **25%** = \\(\\frac{1}{4}\\)

If something increases by 20%, Base : New is locked as **5 : 6**. Every calculation becomes instantaneous mental ratio arithmetic!

---

### 🧠 Why This Works
Percentages are arbitrary human scaling factors (per 100). Fractions represent the true physical parts of the quantity, removing rounding errors completely.

### ⚠️ Trap to Avoid
Never apply successive changes by adding percentages directly (e.g., 20% discount + 10% discount is **NOT 30%**; it is \\(100 \\times 0.8 \\times 0.9 = 72\\), giving a **28% net discount**)!`;
        }

        // Default General LaquTum Breakdown
        return banner + `### 🎯 The LaquTum Way of Learning

I have received your question! Under the **LaquTum Way of Learning**, you can master anything and everything through 4 foundational pillars:

1. **First-Principles Deconstruction**: Strip away complicated jargon and traditional rote memorization. We identify the fundamental truth that cannot be broken down further.
2. **Universal Pattern Recognition**: Complex problems are just simple core patterns wearing different costumes. Once you see the underlying invariant, the solution is immediate.
3. **The 30-Second Intuitive Shortcut**: Direct mental pathways that let you solve problems or internalize concepts without memorizing 10-step formulas.
4. **Deep Mental Intuition & Traps**: Understand *why* it works intuitively so the knowledge stays with you forever, while recognizing the common blindspots and surface fallacies.

> 💡 **Ready for Live AI**: Once you paste your \`API_KEY\` into \`ai-config.js\`, I will break down any concept, textbook question, research topic, or photo you provide using the live Google Gemini model!`;
    }

    /**
     * Update Feed UI & Scroll
     */
    function updateFeedUI() {
        const feed = $('ai-chat-messages');
        if (!feed) return;
        feed.innerHTML = messages.length === 0 ? renderWelcomeHero() : renderMessageList();
        attachEventListeners();
        scrollToBottom();
    }

    function scrollToBottom() {
        const feed = $('ai-chat-messages');
        if (feed) {
            setTimeout(() => {
                feed.scrollTop = feed.scrollHeight;
            }, 60);
        }
    }

    function formatTime(timestamp) {
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHTML(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * Markdown to HTML formatter for AI responses
     */
    function formatMarkdown(text) {
        if (!text) return '';
        let html = escapeHTML(text);

        // Bold **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Headers ###
        html = html.replace(/### (.*?)\n/g, '<h4 class="ai-heading">$1</h4>');
        html = html.replace(/## (.*?)\n/g, '<h3 class="ai-heading-lg">$1</h3>');

        // Blockquotes > text
        html = html.replace(/^&gt; (.*$)/gim, '<div class="ai-blockquote">$1</div>');

        // Inline Code `code`
        html = html.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');

        // Math blocks $$ ... $$
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="ai-math-box">$1</div>');
        html = html.replace(/\\\(([\s\S]*?)\\\)/g, '<span class="ai-math-inline">$1</span>');

        // Horizontal rules ---
        html = html.replace(/---/g, '<hr class="ai-divider"/>');

        // Unordered List * or -
        html = html.replace(/^\* (.*$)/gim, '<li class="ai-li">$1</li>');
        html = html.replace(/^- (.*$)/gim, '<li class="ai-li">$1</li>');

        // Wrap consecutive <li> into <ul>
        html = html.replace(/(<li class="ai-li">.*<\/li>)+/gs, '<ul class="ai-ul">$&</ul>');

        // Line breaks
        html = html.replace(/\n\n/g, '<br><br>');
        html = html.replace(/\n/g, '<br>');

        return html;
    }

    return {
        openChat,
        render: renderChatUI
    };
})();

if (typeof window !== 'undefined') {
    window.AITutor = AITutor;
}
