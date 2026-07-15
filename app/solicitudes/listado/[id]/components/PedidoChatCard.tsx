"use client";

import { FormEvent } from "react";
import { cardClass, cardPad, textareaClass, btnPrimary } from "../styles";
import { ChatMessage } from "../types";

type Props = {
  chatMessages: ChatMessage[];
  newMessage: string;
  setNewMessage: (value: string) => void;
  handleSendMessage: (e: FormEvent) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  nameByEmail: Record<string, string>;
  user: any;
};

export default function PedidoChatCard({
  chatMessages,
  newMessage,
  setNewMessage,
  handleSendMessage,
  chatEndRef,
  nameByEmail,
  user,
}: Props) {
  return (
    <div className={`${cardClass} ${cardPad} lg:col-span-3 flex flex-col`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white/90">
            Canal de comunicación
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Mensajes entre administradores y usuarios sobre este pedido.
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1 rounded-2xl border border-white/10 bg-black/20 overflow-hidden flex flex-col">
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2">
          {chatMessages.length === 0 ? (
            <p className="text-white/55 text-sm text-center mt-6">
              Aún no hay mensajes en este pedido.
            </p>
          ) : (
            chatMessages.map((m) => {
              const fecha =
                m.createdAt?.toDate?.() instanceof Date
                  ? m.createdAt.toDate()
                  : null;

              const isMine = user && m.userId && m.userId === user.uid;

              const email = m.userEmail || m.userName || undefined;
              const friendlyName =
                (email && nameByEmail[email]) ||
                m.userName ||
                (m.isAdmin ? "Admin" : "Usuario");

              const bubbleMine =
                "bg-emerald-500/15 border border-emerald-400/25 text-emerald-50";
              const bubbleOther =
                "bg-white/5 border border-white/10 text-white/90";

              return (
                <div
                  key={m.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      isMine ? bubbleMine : bubbleOther
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-[11px] font-semibold text-white/80">
                        {friendlyName}
                        {m.isAdmin ? " · Admin" : ""}
                      </span>

                      {fecha && (
                        <span className="text-[10px] text-white/45">
                          {fecha.toLocaleDateString()}{" "}
                          {fecha.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={handleSendMessage}
          className="border-t border-white/10 p-3 sm:p-4"
        >
          <textarea
            className={textareaClass}
            rows={2}
            placeholder="Escribe un mensaje…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e as any);
              }
            }}
          />

          <div className="mt-3 flex items-center justify-end">
            <button
              type="submit"
              className={btnPrimary}
              disabled={!newMessage.trim()}
            >
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}