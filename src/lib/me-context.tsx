import { createContext, useContext } from "react";
import type { Me } from "@/lib/data";

export const MeContext = createContext<Me | null>(null);
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside a signed-in shell");
  return me;
}
