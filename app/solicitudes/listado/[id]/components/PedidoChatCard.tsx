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
    <div className={`${cardClass} ${cardPad} lg:col-span-3 flex min-w-0 flex-col`}>
      <div>
        <h2 className="text-lg font-semibold text-white/90">
          Canal de comunicación
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-white/60">
          Mensajes sobre este pedido.
        </p>
      </div>

      <div className="mt-4 flex min-h-[420px] max-h-[70dvh] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/20 sm:min-h-[480px]">
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-4">
              <p className="text-center text-sm text-white/55">
                Aún no hay mensajes en este pedido.
              </p>
            </div>
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
                    className={`min-w-0 max-w-[92%] sm:max-w-[80%] rounded-2xl px-3 py-2.5 ${
                      isMine ? bubbleMine : bubbleOther
                    }`}
                  >
                    <div className="mb-1.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="truncate text-[11px] font-semibold text-white/80">
                        {friendlyName}
                        {m.isAdmin ? " · Admin" : ""}
                      </span>

                      {fecha && (
                        <span className="shrink-0 text-[10px] text-white/45">
                          {fecha.toLocaleDateString()} {" "}
                          {fecha.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
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
          className="shrink-0 border-t border-white/10 bg-black/25 p-3 sm:p-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4"
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
