"use client";

import { createContext, useContext } from "react";
import type { Request } from "@/db/schema";

const RequestsContext = createContext<Request[]>([]);

export function RequestsProvider({
  requests,
  children,
}: {
  requests: Request[];
  children: React.ReactNode;
}) {
  return (
    <RequestsContext.Provider value={requests}>
      {children}
    </RequestsContext.Provider>
  );
}

export function useRequests(): Request[] {
  return useContext(RequestsContext);
}
