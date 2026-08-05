'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParent } from '../ParentContext';
import { api } from '@/lib/api';
import { Send, User, MessageSquare, ShieldAlert, CheckCheck, Loader2, Sparkles, Clock, Lock } from 'lucide-react';

// Set to true when Messages & Chat feature is fully launched
const SHOW_CHAT_UI = false;

export default function ChatPage() {
  const { selectedChild } = useParent();
  const [activeChannel, setActiveChannel] = useState<'TEACHER' | 'ADMIN'>('TEACHER');
  const [inputText, setInputText] = useState('');
  
  // Simulated thread messages (Preserved for full chat rollout)
  const [messages, setMessages] = useState<any>({
    TEACHER: [
      { sender: 'TEACHER', text: 'Hello, I wanted to discuss Ahmed\'s progress in Algebra. He did excellent on his quiz today!', timestamp: '10:30 AM' },
      { sender: 'PARENT', text: 'Thank you! We have been practicing at home. Does he need to focus on any specific area?', timestamp: '10:45 AM' },
      { sender: 'TEACHER', text: 'Just quadratic functions. I\'ll send some practice worksheets tomorrow.', timestamp: '10:50 AM' },
    ],
    ADMIN: [
      { sender: 'ADMIN', text: 'Hello, the term-1 bus fees receipt has been updated in your profile ledger.', timestamp: 'Yesterday' },
      { sender: 'PARENT', text: 'Thank you, I checked it. Is the bus timings changing next week?', timestamp: 'Yesterday' },
      { sender: 'ADMIN', text: 'No, the timings remain the same. The route changes are only for Route C.', timestamp: 'Yesterday' },
    ]
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (SHOW_CHAT_UI) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeChannel]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage = {
      sender: 'PARENT',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev: any) => ({
      ...prev,
      [activeChannel]: [...prev[activeChannel], newMessage]
    }));

    setInputText('');

    setTimeout(() => {
      let replyText = 'Understood. We will look into this and get back to you shortly.';
      if (activeChannel === 'TEACHER') {
        replyText = `Thank you for the message. I will share the worksheets with ${selectedChild?.name || 'the student'} tomorrow.`;
      }
      
      const replyMessage = {
        sender: activeChannel,
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev: any) => ({
        ...prev,
        [activeChannel]: [...prev[activeChannel], replyMessage]
      }));
    }, 1500);
  };

  if (!selectedChild) {
    return (
      <div className="text-slate-500 text-sm text-center py-12">
        Please select a child to view messaging channels.
      </div>
    );
  }

  // Render "Coming Soon" placeholder UI until feature is fully completed
  if (!SHOW_CHAT_UI) {
    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-16 px-4 animate-fade-in relative">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 shadow-sm text-center relative overflow-hidden space-y-6">
          {/* Subtle background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Module Tag Header */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-[#2E5BFF] text-xs font-bold uppercase tracking-wider">
            <span>🚧 Messages & Chat</span>
          </div>

          {/* Animated Hero Icon */}
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-[#2E5BFF]/10 rounded-3xl animate-pulse" />
            <div className="w-16 h-16 rounded-2xl bg-[#2E5BFF] text-white flex items-center justify-center shadow-lg shadow-blue-500/20 relative z-10">
              <MessageSquare className="w-8 h-8" />
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Coming Soon
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-normal">
              This feature is currently under development and will be available in a future update.
            </p>
          </div>

          {/* Feature Capabilities Teaser */}
          <div className="pt-4 border-t border-slate-100 max-w-md mx-auto space-y-2.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">What to expect</p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                💬 Direct Teacher Messaging
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                ⚡ Real-Time Office Helpdesk
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-medium">
                🔒 Secure Encrypted Chat
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preserved original Chat UI (activates automatically when SHOW_CHAT_UI is set to true)
  const currentThread = messages[activeChannel] || [];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-160px)] lg:h-[calc(100vh-140px)] flex flex-col lg:flex-row bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm animate-fade-in shrink-0">
      
      {/* Channels Sidebar List */}
      <div className="w-full lg:w-72 border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 shrink-0">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4.5 h-4.5 text-[#2E5BFF]" />
            Support Channels
          </h3>
          <p className="text-[10px] text-slate-500 font-light mt-0.5">Secure direct messaging dashboard.</p>
        </div>
        <div className="p-2 space-y-1 overflow-y-auto flex-1 bg-slate-50/50">
          <button
            onClick={() => setActiveChannel('TEACHER')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all border ${
              activeChannel === 'TEACHER'
                ? 'bg-blue-50 border-blue-100 text-[#2E5BFF] font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-200">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs">Class Advisor</h4>
              <p className="text-[9px] text-slate-500 font-light mt-0.5 truncate">Mrs. Ananya Sharma</p>
            </div>
          </button>

          <button
            onClick={() => setActiveChannel('ADMIN')}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all border ${
              activeChannel === 'ADMIN'
                ? 'bg-blue-50 border-blue-100 text-[#2E5BFF] font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-200">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs">School Office / Admin</h4>
              <p className="text-[9px] text-slate-500 font-light mt-0.5 truncate">Helpdesk accounts support</p>
            </div>
          </button>
        </div>
      </div>

      {/* Chat conversation panel viewports */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50/10">
        
        {/* Active header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/30 shrink-0 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-700">
              {activeChannel === 'TEACHER' ? 'Conversation with Mrs. Ananya Sharma' : 'EduTrack Helpdesk Support'}
            </h4>
            <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider block mt-0.5">Secure Encryption Enabled</span>
          </div>
          <span className="text-[9px] text-emerald-600 flex items-center gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Online
          </span>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {currentThread.map((msg: any, idx: number) => {
            const isMe = msg.sender === 'PARENT';
            return (
              <div
                key={idx}
                className={`flex flex-col max-w-[75%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  isMe 
                    ? 'bg-[#2E5BFF] text-white rounded-tr-none shadow-sm' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-xs'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1 px-1 flex items-center gap-1 select-none">
                  {msg.timestamp}
                  {isMe && <CheckCheck className="w-3 h-3 text-[#2E5BFF]" />}
                </span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Send message text input form */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex gap-3.5 shrink-0">
          <input
            type="text"
            placeholder="Type your message here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]"
          />
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-[#2E5BFF] hover:bg-blue-600 text-white transition-all cursor-pointer flex items-center justify-center shrink-0 min-h-[38px] min-w-[38px]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
