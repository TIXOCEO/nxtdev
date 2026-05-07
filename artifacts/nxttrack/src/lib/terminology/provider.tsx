"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_TERMINOLOGY } from "./defaults";
import type { Terminology } from "./types";

const TerminologyContext = createContext<Terminology>(DEFAULT_TERMINOLOGY);

export interface TerminologyProviderProps {
  value: Terminology;
  children: ReactNode;
}

export function TerminologyProvider({ value, children }: TerminologyProviderProps) {
  return (
    <TerminologyContext.Provider value={value}>{children}</TerminologyContext.Provider>
  );
}

/**
 * Geef het terminologie-object van de actieve tenant terug. Wanneer er
 * geen provider om de tree zit, komt de hardcoded fallback terug zodat
 * client-componenten nooit op `undefined` aanvallen.
 */
export function useTerminology(): Terminology {
  return useContext(TerminologyContext);
}
