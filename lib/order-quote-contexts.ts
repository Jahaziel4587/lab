import { collection, getDocs } from "firebase/firestore";
import { db } from "@/src/firebase/firebaseConfig";

// The original quote lives on the order; repetitions have their own quotes.
export async function loadOrderQuoteContexts(
  pedidoId: string,
  original: Record<string, any>,
  onQuoteError?: (error: unknown) => void,
) {
  const executions = await getDocs(collection(db, "pedidos", pedidoId, "ejecuciones"));
  const contexts = [
    { id: "original", data: original, path: ["pedidos", pedidoId] },
    ...executions.docs.map((execution) => ({
      id: execution.id,
      data: execution.data(),
      path: ["pedidos", pedidoId, "ejecuciones", execution.id],
    })),
  ];
  return Promise.all(contexts.map(async (context) => {
    try {
      const lines = await getDocs(collection(db, context.path[0], ...context.path.slice(1), "quote_live", "live", "lines"));
      return { ...context, lines: lines.docs.map((line) => line.data()) };
    } catch (error) {
      if (!onQuoteError) throw error;
      onQuoteError(error);
      return { ...context, lines: [] };
    }
  }));
}

export function quoteSubtotal(lines: Record<string, any>[]) {
  return lines.reduce((sum, line) => {
    const value = Number(line.subtotalMXN ?? line.displayTotal ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}
