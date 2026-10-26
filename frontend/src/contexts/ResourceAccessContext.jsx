import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import useAuth from "../hooks/useAuth";
import ResourceAccessAuthorizer from "../components/resource-access-authorizer";
import api from "../api";

export const ResourceAccessContext = createContext(null);

function isValidResource(resource) {
  return Boolean(
    resource?.type && resource?.id !== undefined && resource?.id !== null,
  );
}

export default function ResourceAccessProvider({
  children,
  client = api.resourceAccess,
}) {
  const { fetchUser } = useAuth();
  const [request, setRequest] = useState(null);
  const requestRef = useRef(null);
  const activeResourcesRef = useRef(new Set());

  const authorizeResource = useCallback(
    async (resource, { allowCancel = true } = {}) => {
      if (!isValidResource(resource)) return false;
      const key = `${resource.type}:${resource.id}`;
      if (activeResourcesRef.current.has(key) || requestRef.current)
        return false;
      activeResourcesRef.current.add(key);
      try {
        const decision = await client.check(resource);
        if (decision.allGranted) return true;
        return await new Promise((resolve) => {
          const nextRequest = { resource, decision, resolve, key, allowCancel };
          requestRef.current = nextRequest;
          setRequest(nextRequest);
        });
      } catch {
        return false;
      } finally {
        activeResourcesRef.current.delete(key);
      }
    },
    [client],
  );

  const resolveRequest = useCallback((allowed) => {
    requestRef.current?.resolve(allowed);
    requestRef.current = null;
    setRequest(null);
  }, []);

  const verifyPassword = useCallback(
    async ({ resource, password }) => {
      return client.verifyPassword(resource, password);
    },
    [client],
  );

  const finalize = useCallback(
    async ({ resource }) => {
      const decision = await client.finalize(resource);
      await fetchUser();
      return decision;
    },
    [client, fetchUser],
  );

  const value = useMemo(() => ({ authorizeResource }), [authorizeResource]);

  return (
    <ResourceAccessContext.Provider value={value}>
      {children}
      {request ? (
        <ResourceAccessAuthorizer
          resource={request.resource}
          decision={request.decision}
          autoOpen
          allowCancel={request.allowCancel}
          onPasswordVerifying={({ resource, password }) =>
            verifyPassword({ resource, password })
          }
          onFinalizing={({ resource }) => finalize({ resource })}
          onAuthorized={() => resolveRequest(true)}
          onRejected={() => resolveRequest(false)}
        />
      ) : null}
    </ResourceAccessContext.Provider>
  );
}

export function useResourceAccess() {
  const context = useContext(ResourceAccessContext);
  if (!context)
    throw new Error(
      "useResourceAccess must be used within ResourceAccessProvider.",
    );
  return context;
}
