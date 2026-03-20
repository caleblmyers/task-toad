import { createContext, useContext } from 'react';

type CanFunction = (permission: string) => boolean;

const PermissionContext = createContext<CanFunction>(() => true);

export function PermissionProvider({
  can,
  children,
}: {
  can: CanFunction;
  children: React.ReactNode;
}) {
  return (
    <PermissionContext.Provider value={can}>
      {children}
    </PermissionContext.Provider>
  );
}

export function useCan(): CanFunction {
  return useContext(PermissionContext);
}
