/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Chat } from "@google/genai";
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Chess } from 'chess.js';

// Add type declarations for browser-specific Speech Recognition API
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// SpeechRecognition type declaration for browsers that use webkit prefix
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface Message {
    id: string;
    role: 'user' | 'model';
    text?: string;
    component?: React.ReactNode;
}

const App = () => {
    const [history, setHistory] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isTtsEnabled, setIsTtsEnabled] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isGameModalOpen, setIsGameModalOpen] = useState(false);
    const [activeGame, setActiveGame] = useState<'none' | 'tictactoe' | 'chess'>('none');
    
    const chatRef = useRef<Chat | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any | null>(null);
    const chessRef = useRef<any>(null);

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
                setHistory([{ id: 'init-1', role: 'model', text: 'Good day, Srabon. Victor online and ready to assist.' }]);
            } catch (error) {
                console.error("Failed to initialize chat:", error);
                setHistory([{ id: 'init-error-1', role: 'model', text: 'Error: Could not initialize AI services. Please check configuration.' }]);
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
    
    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (!(event.target as HTMLElement).closest('.message-menu, .message-options-button, .game-modal')) {
                setActiveMenu(null);
                setIsGameModalOpen(false);
            }
        };

        if (activeMenu || isGameModalOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [activeMenu, isGameModalOpen]);

    const speak = (text: string) => {
        if (!window.speechSynthesis || voices.length === 0) return;

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
    
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setActiveMenu(null);
    };

    const handleReadAloud = (text: string) => {
        if (text) speak(text);
        setActiveMenu(null);
    };

    const endGame = () => {
        setActiveGame('none');
        setHistory(prev => [...prev, {id: `game-end-${Date.now()}`, role: 'model', text: 'Game concluded. I am ready for your next command, Srabon.'}]);
    };

    // --- Tic-Tac-Toe Logic ---
    const startTicTacToe = () => {
        setIsGameModalOpen(false);
        setActiveGame('tictactoe');
        const initialBoard = Array(3).fill(null).map(() => Array(3).fill(null));
        const messages: Message[] = [
            { id: `game-start-1`, role: 'model', text: `An excellent choice, Srabon. Let's play Tic-Tac-Toe. You are 'X'. Make your move.` },
            { id: `game-board-1`, role: 'model', component: <TicTacToeBoard board={initialBoard} status="playing" onCellClick={handlePlayerMove} /> }
        ];
        setHistory(prev => [...prev, ...messages]);
    };

    const checkWinner = (board: (string | null)[][]): 'X' | 'O' | 'Draw' | null => {
        const lines = [
            [board[0][0], board[0][1], board[0][2]], [board[1][0], board[1][1], board[1][2]], [board[2][0], board[2][1], board[2][2]],
            [board[0][0], board[1][0], board[2][0]], [board[0][1], board[1][1], board[2][1]], [board[0][2], board[1][2], board[2][2]],
            [board[0][0], board[1][1], board[2][2]], [board[0][2], board[1][1], board[2][0]],
        ];
        for (const line of lines) {
            if (line[0] && line[0] === line[1] && line[0] === line[2]) return line[0] as 'X' | 'O';
        }
        if (board.every(row => row.every(cell => cell))) return 'Draw';
        return null;
    };
    
    const handlePlayerMove = (row: number, col: number, currentBoard: (string | null)[][]) => {
        if (currentBoard[row][col] || checkWinner(currentBoard)) return;
        const newBoard = currentBoard.map(r => [...r]);
        newBoard[row][col] = 'X';
        setHistory(prev => [...prev, { id: `game-board-${Date.now()}`, role: 'user', component: <TicTacToeBoard board={newBoard} status="playing" onCellClick={() => {}} />}]);
        const winner = checkWinner(newBoard);
        if (winner) {
            let endMessage = winner === 'X' ? "Congratulations, Srabon, you've won!" : "A draw. A well-played game.";
            setHistory(prev => [...prev, { id: `game-end-msg-${Date.now()}`, role: 'model', text: endMessage }]);
            endGame();
            return;
        }
        setTimeout(() => handleAiMove(newBoard), 500);
    };

    const handleAiMove = (currentBoard: (string | null)[][]) => {
        const emptyCells: {row: number, col: number}[] = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!currentBoard[r][c]) emptyCells.push({row: r, col: c});
        const move = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const newBoard = currentBoard.map(r => [...r]);
        if(move) newBoard[move.row][move.col] = 'O';
        const winner = checkWinner(newBoard);
        const status = winner ? 'finished' : 'playing';
        setHistory(prev => [...prev, { id: `game-board-${Date.now()}`, role: 'model', component: <TicTacToeBoard board={newBoard} status={status} onCellClick={handlePlayerMove} /> }]);
        if (winner) {
            let endMessage = winner === 'O' ? "It appears I have won this round. Better luck next time, Srabon." : "A draw. A well-played game.";
            setHistory(prev => [...prev, { id: `game-end-msg-${Date.now()}`, role: 'model', text: endMessage }]);
            endGame();
        }
    };
    
    const TicTacToeBoard = ({ board, status, onCellClick }: { board: (string | null)[][], status: string, onCellClick: (row: number, col: number, board: (string|null)[][]) => void }) => (
        <div className="tic-tac-toe-board">
            {board.map((row, rIndex) => row.map((cell, cIndex) => (
                <button key={`${rIndex}-${cIndex}`} className={`tic-tac-toe-cell ${cell ? (cell === 'X' ? 'x' : 'o') : ''}`} onClick={() => onCellClick(rIndex, cIndex, board)} disabled={!!cell || status !== 'playing'} aria-label={`Cell ${rIndex}, ${cIndex} is ${cell || 'empty'}`}>{cell}</button>
            )))}
        </div>
    );

    // --- Chess Logic ---
    const startChess = () => {
        setIsGameModalOpen(false);
        setActiveGame('chess');
        chessRef.current = new Chess();
        const messages: Message[] = [
            { id: `game-start-chess-1`, role: 'model', text: `Very well, Srabon. A game of Chess it is. You play as White. Your move.` },
            { id: `game-board-chess-1`, role: 'model', component: <ChessBoard fen={chessRef.current.fen()} onMove={handlePlayerChessMove} /> }
        ];
        setHistory(prev => [...prev, ...messages]);
    };

    const handlePlayerChessMove = (move: any): boolean => {
        if (!chessRef.current || chessRef.current.isGameOver()) return false;
        const result = chessRef.current.move(move);
        if (result === null) return false;
        const newFen = chessRef.current.fen();
        setHistory(prev => [...prev, {id: `game-board-chess-user-${Date.now()}`, role: 'user', component: <ChessBoard fen={newFen} onMove={() => false} />}]);
        if (chessRef.current.isGameOver()) {
            handleChessGameOver();
        } else {
            setTimeout(() => handleAiChessMove(), 500);
        }
        return true;
    };

    const handleAiChessMove = () => {
        if (!chessRef.current || chessRef.current.isGameOver()) return;
        const moves = chessRef.current.moves();
        const move = moves[Math.floor(Math.random() * moves.length)];
        chessRef.current.move(move);
        const newFen = chessRef.current.fen();
        const messages: Message[] = [{id: `game-board-chess-ai-${Date.now()}`, role: 'model', component: <ChessBoard fen={newFen} onMove={handlePlayerChessMove} />}];
        if (chessRef.current.inCheck()) {
            messages.unshift({ id: `chess-check-${Date.now()}`, role: 'model', text: 'Check.' });
        }
        setHistory(prev => [...prev, ...messages]);
        if (chessRef.current.isGameOver()) {
            handleChessGameOver();
        }
    };

    const handleChessGameOver = () => {
        let message = "The game is over.";
        if (chessRef.current.isCheckmate()) {
            message = chessRef.current.turn() !== 'w' ? "Checkmate. An impressive victory, Srabon." : "Checkmate. I have won this time, Srabon.";
        } else if (chessRef.current.isDraw()) {
            if (chessRef.current.isStalemate()) message = "Stalemate. The game is a draw.";
            else if (chessRef.current.isThreefoldRepetition()) message = "Draw by threefold repetition.";
            else if (chessRef.current.isInsufficientMaterial()) message = "Draw due to insufficient material.";
            else message = "The game is a draw."
        }
        setHistory(prev => [...prev, { id: `game-end-msg-${Date.now()}`, role: 'model', text: message }]);
        endGame();
    };
    
    const ChessBoard = ({ fen, onMove }: { fen: string, onMove: (move: any) => boolean }) => {
        const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
        const chess = new Chess(fen);
        const possibleMoves = selectedSquare ? chess.moves({ square: selectedSquare, verbose: true }).map(m => m.to) : [];

        const pieceSymbols: { [color: string]: { [type: string]: string } } = {
            w: { p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔' },
            b: { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }
        };

        const handleSquareClick = (square: string) => {
            if (chess.turn() !== 'w' || chess.isGameOver()) return;
            if (selectedSquare) {
                const move = { from: selectedSquare, to: square, promotion: 'q' };
                if (!onMove(move)) { // if move was illegal, try selecting the new square
                    const piece = chess.get(square);
                    if (piece && piece.color === 'w') setSelectedSquare(square);
                    else setSelectedSquare(null);
                } else {
                    setSelectedSquare(null);
                }
            } else {
                const piece = chess.get(square);
                if (piece && piece.color === 'w') setSelectedSquare(square);
            }
        };
        
        const board = [];
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                const squareInfo = chess.board()[i][j];
                const squareName = String.fromCharCode(97 + j) + (8 - i);
                const isLight = (i + j) % 2 !== 0;
                const isPossibleMove = possibleMoves.includes(squareName);
                board.push(
                    <div key={squareName} className={`chess-square ${isLight ? 'light' : 'dark'} ${selectedSquare === squareName ? 'selected' : ''} ${isPossibleMove ? 'possible-move' : ''}`} onClick={() => handleSquareClick(squareName)}>
                        {squareInfo && <span className={`chess-piece ${squareInfo.color}`}>{pieceSymbols[squareInfo.color][squareInfo.type]}</span>}
                        {isPossibleMove && !squareInfo && <div className="possible-move-indicator"></div>}
                    </div>
                );
            }
        }
        return <div className="chess-board">{board}</div>;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !chatRef.current) return;

        speechSynthesis.cancel();
        if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
        }

        const userMessage: Message = { id: `user-${Date.now()}`, role: 'user' as const, text: userInput };
        setHistory(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);

        const modelMessageId = `model-${Date.now()}`;
        const modelMessage: Message = { id: modelMessageId, role: 'model' as const, text: '' };
        setHistory(prev => [...prev, modelMessage]);

        let fullModelResponse = '';

        try {
            const result = await chatRef.current.sendMessageStream({ message: userMessage.text! });
            
            for await (const chunk of result) {
                const chunkText = chunk.text;
                fullModelResponse += chunkText;
                setHistory(prev => {
                    return prev.map(msg => 
                        msg.id === modelMessageId 
                        ? { ...msg, text: (msg.text || '') + chunkText } 
                        : msg
                    );
                });
            }
        } catch (error) {
            console.error("Error sending message:", error);
            fullModelResponse = "Apologies, Srabon. I seem to be having some trouble connecting to the network.";
            setHistory(prev => {
                return prev.map(msg => 
                    msg.id === modelMessageId
                    ? { ...msg, text: fullModelResponse }
                    : msg
                );
            });
        } finally {
            setIsLoading(false);
            if (isTtsEnabled && fullModelResponse) {
                speak(fullModelResponse);
            }
        }
    };

    return (
        <div className="jarvis-app">
            <header className="app-header">
                <h1>Victor</h1>
                <div className="header-controls">
                     <button onClick={() => setIsGameModalOpen(true)} className="control-button" aria-label="Open game center">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.58 16.09l-1.09-1.09-1.09-1.09-1.09-1.09-1.09-1.09-1.09-1.1L15 9.41l-1.09-1.09-1.09-1.09L11.73 6.1l-1.09-1.09-1.09-1.09L8.46 2.83 7.37 1.74 6.28.65 5.19 1.74l-1.1 1.1-1.1 1.1-1.1 1.1L.8 6.13l-1.1 1.1 1.1 1.1 1.1 1.1L3.09 11l1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.1 1.09 1.1 1.1 1.09 1.1 1.1 1.1 1.1-1.1 1.1-1.1 1.1-1.1 1.09-1.1zm-3.75-5.34c.28-.28.28-.72 0-1s-.72-.28-1 0l-2.06 2.06-2.06-2.06c-.28-.28-.72-.28-1 0s-.28.72 0 1l2.06 2.06-2.06 2.06c-.28.28-.28.72 0 1s.72.28 1 0l2.06-2.06 2.06 2.06c.28.28.72.28 1 0s.28-.72 0-1l-2.06-2.06zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                    </button>
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
                {history.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.role}`}>
                         <div className="message-wrapper">
                            <div className="message-bubble">
                                {msg.text && <p>{msg.text}</p>}
                                {msg.component}
                            </div>
                            {msg.text && (
                                <div className="message-actions">
                                    <button className="message-options-button" onClick={() => setActiveMenu(activeMenu === msg.id ? null : msg.id)} aria-label="Message options">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                                    </button>
                                    {activeMenu === msg.id && (
                                        <div className="message-menu">
                                            <button onClick={() => handleCopy(msg.text!)}>Copy</button>
                                            {msg.role === 'model' && <button onClick={() => handleReadAloud(msg.text!)}>Read Aloud</button>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && !history.slice(-1)[0]?.text && (
                     <div className="chat-message model">
                        <div className="message-wrapper">
                             <div className="message-bubble">
                               <div className="typing-indicator">
                                    <span></span><span></span><span></span>
                               </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
            <footer className="input-area">
                {activeGame !== 'none' ? (
                    <button className="game-button" onClick={endGame}>Forfeit Game</button>
                ) : (
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
                )}
            </footer>
            {isGameModalOpen && (
                <div className="game-modal-overlay">
                    <div className="game-modal">
                        <h2>Game Center</h2>
                        <div className="game-list">
                            <button className="game-selection" onClick={startTicTacToe}>
                                <h3>Tic-Tac-Toe</h3>
                                <p>Challenge Victor to a classic match.</p>
                            </button>
                            <button className="game-selection" onClick={startChess}>
                                <h3>Chess</h3>
                                <p>A classic strategy game against Victor.</p>
                            </button>
                        </div>
                        <button className="close-modal-button" onClick={() => setIsGameModalOpen(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);