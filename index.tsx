/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from "@google/genai";
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

// Add type declarations for browser-specific Speech Recognition API
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// SpeechRecognition type declaration for browsers that use webkit prefix
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const App = () => {
    const [history, setHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    
    const chatRef = useRef<Chat | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any | null>(null);

    useEffect(() => {
        document.documentElement.className = theme;
    }, [theme]);

    useEffect(() => {
        const loadVoices = () => {
            setVoices(speechSynthesis.getVoices());
        };
        speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }, []);

    useEffect(() => {
        const initChat = () => {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
                chatRef.current = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: "You are Victor, a sophisticated and helpful AI assistant. Your user's name is Srabon. Always address him as Srabon. Respond with a blend of professionalism, wit, and a slightly futuristic tone. Keep your answers concise and to the point. Format your responses with markdown.",
                    },
                });
                setHistory([{ role: 'model', text: 'Good day, Srabon. Victor online and ready to assist.' }]);
            } catch (error) {
                console.error("Failed to initialize chat:", error);
                setHistory([{ role: 'model', text: 'Error: Could not initialize AI services. Please check configuration.' }]);
            }
        };
        initChat();
    }, []);
    
    useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, [history, isLoading]);

    useEffect(() => {
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0])
                .map((result: any) => result.transcript)
                .join('');
            setUserInput(transcript);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error:", event.error);
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    const speak = (text: string) => {
        if (!isTtsEnabled || !window.speechSynthesis || voices.length === 0) return;

        speechSynthesis.cancel(); // Stop any previous speech
        const utterance = new SpeechSynthesisUtterance(text);
        
        let chosenVoice: SpeechSynthesisVoice | null = null;

        if (voiceGender === 'male') {
             chosenVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('male')) ||
                           voices.find(v => v.name === 'Google US English') ||
                           voices.find(v => v.name === 'David' || v.name === 'Microsoft David - English (United States)');
        } else { // female
             chosenVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
                           voices.find(v => v.name === 'Google UK English Female') ||
                           voices.find(v => v.name === 'Zira' || v.name === 'Microsoft Zira - English (United States)');
        }
        
        utterance.voice = chosenVoice || voices.find(v => v.lang.startsWith('en')) || voices[0];

        speechSynthesis.speak(utterance);
    };

    const handleListenClick = () => {
        if (isLoading || !recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    const toggleTts = () => {
        setIsTtsEnabled(prev => {
            if (prev) { // if it was on and is being turned off
                speechSynthesis.cancel();
            }
            return !prev;
        });
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    }

    const toggleVoiceGender = () => {
        setVoiceGender(prev => prev === 'male' ? 'female' : 'male');
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !chatRef.current) return;

        speechSynthesis.cancel();
        if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
        }

        const userMessage = { role: 'user' as const, text: userInput };
        setHistory(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);

        const modelMessage = { role: 'model' as const, text: '' };
        setHistory(prev => [...prev, modelMessage]);

        let fullModelResponse = '';

        try {
            const result = await chatRef.current.sendMessageStream({ message: userMessage.text });
            
            for await (const chunk of result) {
                const chunkText = chunk.text;
                fullModelResponse += chunkText;
                setHistory(prev => {
                    const newHistory = [...prev];
                    const lastMessage = newHistory[newHistory.length - 1];
                    if (lastMessage.role === 'model') {
                        lastMessage.text += chunkText;
                    }
                    return newHistory;
                });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            fullModelResponse = "Apologies, Srabon. I seem to be having some trouble connecting to the network.";
            const errorMessage = { role: 'model' as const, text: fullModelResponse };
             setHistory(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1] = errorMessage;
                return newHistory;
            });
        } finally {
            setIsLoading(false);
            if (fullModelResponse) {
                speak(fullModelResponse);
            }
        }
    };

    return (
        <div className="jarvis-app">
            <header className="app-header">
                <h1>Victor</h1>
                <div className="header-controls">
                    <button onClick={toggleTheme} className="control-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                        {theme === 'dark' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.31 0-6-2.69-6-6 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.03-.89.24-1.74.58-2.5L3.17 9.09 4.59 7.67l1.41 1.41C6.26 8.84 7.11 8.63 8 8.59V6h2v2.59c.89.04 1.74.25 2.5.58l1.41-1.41 1.41 1.41-1.41 1.41c.34.76.55 1.61.58 2.5h2v-2h-2c-.04-.89-.25-1.74-.58-2.5l1.41-1.41-1.41-1.41-1.41 1.41c-.76-.34-1.61-.55-2.5-.58V4h-2v2.59c-.89-.04-1.74-.25-2.5-.58L6 4.59 4.59 6l1.41 1.41C5.66 8.16 5.45 9.01 5.41 10H3v2h2.01zM11 18.01V16h2v2.01c.89-.04 1.74-.25 2.5-.58l1.41 1.41 1.41-1.41-1.41-1.41c.34-.76.55-1.61.58-2.5h2v-2h-2.01c-.03.89-.24 1.74-.58 2.5l1.41 1.41-1.41 1.41-1.41-1.41c-.76.34-1.61.55-2.5.58z"/></svg>
                        )}
                    </button>
                    <button onClick={toggleVoiceGender} className={`control-button ${voiceGender === 'female' ? 'active' : ''}`} aria-label={`Switch to ${voiceGender === 'male' ? 'female' : 'male'} voice`}>
                        {voiceGender === 'male' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        ) : (
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z"/></svg>
                        )}
                    </button>
                    <button onClick={toggleTts} className={`control-button ${isTtsEnabled ? 'active' : ''}`} aria-label={isTtsEnabled ? 'Mute text-to-speech' : 'Enable text-to-speech'}>
                        {isTtsEnabled ? (
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
                        ) : (
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>
                        )}
                    </button>
                </div>
                <div className="glow-line"></div>
            </header>
            <main className="chat-container" ref={chatContainerRef}>
                {history.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        <div className="message-bubble">
                            <p>{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && history[history.length -1]?.role === 'user' && (
                     <div className="chat-message model">
                        <div className="message-bubble">
                           <div className="typing-indicator">
                                <span></span><span></span><span></span>
                           </div>
                        </div>
                    </div>
                )}
            </main>
            <footer className="input-area">
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder={isListening ? 'Listening...' : 'Ask Victor...'}
                        aria-label="User input"
                        disabled={isLoading || isListening}
                    />
                    <button type="button" onClick={handleListenClick} className={`mic-button ${isListening ? 'listening' : ''}`} disabled={isLoading} aria-label="Use microphone">
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                           <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/>
                        </svg>
                    </button>
                    <button type="submit" disabled={isLoading || isListening || !userInput.trim()} aria-label="Send message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                           <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </form>
            </footer>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);