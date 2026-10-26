import { createContext, useContext, useEffect, useRef, useState } from "react";
import useI18n from "../../hooks/useI18n";
import { Modal } from "../../packages/modal";
import PasswordInput from "../ui/PasswordInput";
import BalanceIcon from "../ui/BalanceIcon";
import {
  DEFAULT_RESOURCE_ACCESS_ACTIONS,
  getConditionTone,
  normalizeAccessDecision,
} from "./accessDecision";
import "./ResourceAccessAuthorizer.css";

const ResourceAccessAuthorizerContext = createContext(null);

function ConditionIcon({ type }) {
  const icon = {
    encrypted: (
      <>
        <rect x="5.25" y="10.4" width="13.5" height="9.1" rx="1.8" />
        <path d="M8.35 10.4V7.8a3.65 3.65 0 0 1 7.3 0v2.6M12 14.05v2.25" />
      </>
    ),
    book_only: (
      <>
        <path d="M4.2 5.85c2.42-.82 5.02-.33 7.8 1.5v11.1c-2.78-1.83-5.38-2.32-7.8-1.5V5.85Z" />
        <path d="M19.8 5.85c-2.42-.82-5.02-.33-7.8 1.5v11.1c2.78-1.83 5.38-2.32 7.8-1.5V5.85Z" />
      </>
    ),
  }[type] || (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.4v5.1M12 7.6h.01" />
    </>
  );
  if (type === "money" || type === "points")
    return (
      <BalanceIcon
        type={type}
        size={21}
        className="resource-access-authorizer__condition-icon"
      />
    );
  return (
    <svg
      className="resource-access-authorizer__condition-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

function StatusIcon({ tone }) {
  const icon =
    tone === "granted" ? (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="m8.4 12.05 2.3 2.35 4.95-5" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8.1v4.8M12 16h.01" />
      </>
    );
  return (
    <svg
      className={`resource-access-authorizer__status-icon resource-access-authorizer__status-icon--${tone}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

function getConditionLabel(condition, t) {
  if (condition.label) return condition.label;
  const key = `resourceAccess.conditions.${condition.type}`;
  const translated = t(key);
  return translated === key ? condition.type : translated;
}

function formatRequirement(condition, t) {
  if (
    condition.requirement !== undefined &&
    condition.requirement !== null &&
    condition.requirement !== ""
  )
    return condition.requirement;
  if (condition.type === "encrypted")
    return t("resourceAccess.requirements.password");
  if (condition.type === "book_only")
    return t("resourceAccess.requirements.bookContext");
  return t("resourceAccess.requirements.notSpecified");
}

function getBlockedMessage(condition, t) {
  if (condition.message) return condition.message;
  const key = `resourceAccess.status.${condition.status}`;
  const translated = t(key);
  return translated === key
    ? t("resourceAccess.status.unavailable")
    : translated;
}

function DecisionTable({ decision, onAction }) {
  const { t } = useI18n();
  return (
    <div className="resource-access-authorizer__table-shell">
      <table className="resource-access-authorizer__table">
        <thead>
          <tr>
            <th aria-label={t("resourceAccess.table.typeIcon")} />
            <th>{t("resourceAccess.table.type")}</th>
            <th>{t("resourceAccess.table.requirement")}</th>
            <th>{t("resourceAccess.table.authorization")}</th>
          </tr>
        </thead>
        <tbody>
          {decision.conditions.map((condition) => {
            const tone = getConditionTone(condition);
            const canAct = tone === "actionable";
            const hasDiscount =
              condition.discountApplied &&
              condition.originalRequirement !== undefined &&
              condition.discountedRequirement !== undefined;
            return (
              <tr
                key={condition.id}
                className={`resource-access-authorizer__condition-row resource-access-authorizer__condition-row--${tone}`}
              >
                <td>
                  <ConditionIcon type={condition.type} />
                </td>
                <td>
                  <strong>{getConditionLabel(condition, t)}</strong>
                  {condition.message ? (
                    <span className="resource-access-authorizer__condition-message">
                      {condition.message}
                    </span>
                  ) : null}
                </td>
                <td>
                  {hasDiscount ? (
                    <span className="resource-access-authorizer__price-stack">
                      <s>{condition.originalRequirement}</s>
                      <b>{condition.discountedRequirement}</b>
                      <small>
                        {condition.vipLabel || t("resourceAccess.vip")} -
                        {condition.discountPercent}%
                      </small>
                    </span>
                  ) : (
                    formatRequirement(condition, t)
                  )}
                </td>
                <td className="resource-access-authorizer__authorization-cell">
                  {tone === "granted" ? (
                    <StatusIcon tone="granted" />
                  ) : canAct ? (
                    <button
                      type="button"
                      className="resource-access-authorizer__action"
                      onClick={() => onAction(condition)}
                    >
                      {condition.action ===
                      DEFAULT_RESOURCE_ACCESS_ACTIONS.password
                        ? t("resourceAccess.verify")
                        : t("resourceAccess.purchase")}
                    </button>
                  ) : (
                    <span
                      className="resource-access-authorizer__blocked"
                      title={getBlockedMessage(condition, t)}
                    >
                      <StatusIcon tone="blocked" />
                      <span>{getBlockedMessage(condition, t)}</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResourceAccessAuthorizer({
  resource,
  decision,
  autoOpen = false,
  allowCancel = true,
  onPasswordVerifying,
  onFinalizing,
  onAuthorized,
  onRejected,
  children,
}) {
  const { t } = useI18n();
  const [activeDecision, setActiveDecision] = useState(() =>
    normalizeAccessDecision(decision),
  );
  const [gateOpen, setGateOpen] = useState(false);
  const [actionCondition, setActionCondition] = useState(null);
  const [password, setPassword] = useState("");
  const [actionError, setActionError] = useState("");
  const [runningAction, setRunningAction] = useState(false);
  const [finalizeError, setFinalizeError] = useState("");
  const resolverRef = useRef(null);
  const settledRef = useRef(false);
  const autoOpenedRef = useRef(false);

  useEffect(
    () => setActiveDecision(normalizeAccessDecision(decision)),
    [decision],
  );
  useEffect(() => () => resolverRef.current?.(false), []);

  function reject(reason, error) {
    if (settledRef.current) return;
    settledRef.current = true;
    resolverRef.current?.(false);
    resolverRef.current = null;
    onRejected?.({ resource, decision: activeDecision, reason, error });
  }

  function closeGate() {
    if (!allowCancel) return;
    setGateOpen(false);
    setActionCondition(null);
    setActionError("");
    reject("dismissed");
  }

  function authorize() {
    const currentDecision = normalizeAccessDecision(decision);
    if (!currentDecision) {
      onRejected?.({ resource, decision: null, reason: "invalid_decision" });
      return Promise.resolve(false);
    }
    if (currentDecision.allGranted) {
      onAuthorized?.({ resource, decision: currentDecision });
      return Promise.resolve(true);
    }
    if (resolverRef.current) return Promise.resolve(false);
    setActiveDecision(currentDecision);
    setGateOpen(true);
    settledRef.current = false;
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }

  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    setGateOpen(true);
    settledRef.current = false;
  }, [autoOpen]);

  function openAction(condition) {
    const callback =
      condition.action === DEFAULT_RESOURCE_ACCESS_ACTIONS.password
        ? onPasswordVerifying
        : undefined;
    if (!callback) {
      setGateOpen(false);
      reject("unsupported_action");
      return;
    }
    setActionError("");
    setPassword("");
    setActionCondition(condition);
  }

  async function completeAction() {
    if (!actionCondition || runningAction) return;
    if (
      actionCondition.action === DEFAULT_RESOURCE_ACCESS_ACTIONS.password &&
      !password.trim()
    ) {
      setActionError(t("resourceAccess.passwordRequired"));
      return;
    }
    const callback = onPasswordVerifying;
    setRunningAction(true);
    setActionError("");
    try {
      const nextDecision = normalizeAccessDecision(
        await callback({
          resource,
          decision: activeDecision,
          condition: actionCondition,
          password,
        }),
      );
      if (!nextDecision) throw new Error("Invalid resource access decision.");
      setActiveDecision(nextDecision);
      setActionCondition(null);
      setPassword("");
    } catch (error) {
      setActionError(error?.message || t("resourceAccess.actionFailed"));
    } finally {
      setRunningAction(false);
    }
  }

  function enter() {
    if (!activeDecision?.allGranted) return;
    setGateOpen(false);
    settledRef.current = true;
    resolverRef.current?.(true);
    resolverRef.current = null;
    onAuthorized?.({ resource, decision: activeDecision });
  }

  async function finalize() {
    if (!activeDecision?.canFinalize || runningAction || !onFinalizing) return;
    setRunningAction(true);
    setFinalizeError("");
    try {
      const nextDecision = normalizeAccessDecision(
        await onFinalizing({ resource, decision: activeDecision }),
      );
      if (!nextDecision?.allGranted)
        throw new Error("Resource access could not be finalized.");
      setActiveDecision(nextDecision);
      setGateOpen(false);
      settledRef.current = true;
      resolverRef.current?.(true);
      resolverRef.current = null;
      onAuthorized?.({ resource, decision: nextDecision });
    } catch (error) {
      setFinalizeError(error?.message || t("resourceAccess.finalizeFailed"));
    } finally {
      setRunningAction(false);
    }
  }

  const value = {
    authorize,
    authorizing: gateOpen || runningAction,
    resource,
    decision: activeDecision,
  };
  const actionIsPassword =
    actionCondition?.action === DEFAULT_RESOURCE_ACCESS_ACTIONS.password;
  return (
    <ResourceAccessAuthorizerContext.Provider value={value}>
      {typeof children === "function" ? children(value) : children}
      <Modal
        open={gateOpen}
        onOpenChange={(open) => {
          if (!open && allowCancel) closeGate();
        }}
        closeOnEsc={allowCancel}
        closeOnBackdrop={allowCancel}
        showCloseButton={allowCancel}
        kicker={t("resourceAccess.kicker")}
        title={
          activeDecision?.label ||
          resource?.name ||
          t("resourceAccess.untitledResource")
        }
        tone="warning"
        size="table"
        labels={{
          close: t("resourceAccess.close"),
          cancel: t("resourceAccess.cancel"),
        }}
        actions={[
          ...(allowCancel
            ? [
                {
                  key: "cancel",
                  label: t("resourceAccess.cancel"),
                  variant: "secondary",
                  onClick: ({ close }) => {
                    close();
                  },
                },
              ]
            : []),
          {
            key: "enter",
            label: t("resourceAccess.enter"),
            variant: "primary",
            visible: Boolean(activeDecision?.allGranted),
            onClick: () => enter(),
            keepOpen: true,
          },
          {
            key: "finalize",
            label: t("resourceAccess.confirmAndEnter"),
            loadingLabel: t("resourceAccess.processing"),
            variant: "primary",
            visible: Boolean(
              activeDecision?.canFinalize && activeDecision?.settlementRequired,
            ),
            loading: runningAction,
            onClick: finalize,
            keepOpen: true,
          },
        ]}
      >
        <div className="resource-access-authorizer__content">
          <p className="resource-access-authorizer__intro">
            {activeDecision?.isVip ? (
              <>
                <span className="resource-access-authorizer__vip">
                  {t("resourceAccess.vip")}
                </span>{" "}
                {t("resourceAccess.vipDescription")}
              </>
            ) : (
              t("resourceAccess.intro")
            )}
          </p>
          {activeDecision ? (
            <DecisionTable decision={activeDecision} onAction={openAction} />
          ) : null}
          {finalizeError ? (
            <p className="resource-access-authorizer__action-error">
              {finalizeError}
            </p>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={Boolean(actionCondition)}
        onOpenChange={(open) => {
          if (!open && actionCondition) {
            setActionCondition(null);
            setActionError("");
            setPassword("");
          }
        }}
        kicker={
          actionIsPassword
            ? t("resourceAccess.passwordKicker")
            : t("resourceAccess.purchaseKicker")
        }
        title={
          actionIsPassword
            ? t("resourceAccess.passwordTitle")
            : t("resourceAccess.purchaseTitle")
        }
        tone={actionIsPassword ? "info" : "warning"}
        size="sm"
        labels={{
          close: t("resourceAccess.close"),
          cancel: t("resourceAccess.cancel"),
        }}
        actions={[
          {
            key: "action-cancel",
            label: t("resourceAccess.cancel"),
            variant: "secondary",
          },
          {
            key: "action-confirm",
            label: actionIsPassword
              ? t("resourceAccess.verify")
              : t("resourceAccess.confirmPurchase"),
            loadingLabel: t("resourceAccess.processing"),
            variant: "primary",
            loading: runningAction,
            onClick: completeAction,
            keepOpen: true,
          },
        ]}
      >
        <div className="resource-access-authorizer__dialog-content">
          {actionIsPassword ? (
            <PasswordInput
              label={t("resourceAccess.passwordLabel")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={actionError}
              autoComplete="current-password"
              autoFocus
            />
          ) : (
            <>
              <p>{t("resourceAccess.purchaseDescription")}</p>
              <strong className="resource-access-authorizer__purchase-cost">
                {t("resourceAccess.cost", {
                  amount: formatRequirement(actionCondition || {}, t),
                })}
              </strong>
              {actionError ? (
                <p className="resource-access-authorizer__action-error">
                  {actionError}
                </p>
              ) : null}
            </>
          )}
        </div>
      </Modal>
    </ResourceAccessAuthorizerContext.Provider>
  );
}

export function useResourceAccessAuthorizer() {
  const context = useContext(ResourceAccessAuthorizerContext);
  if (!context)
    throw new Error(
      "useResourceAccessAuthorizer must be used within ResourceAccessAuthorizer.",
    );
  return context;
}

export default ResourceAccessAuthorizer;
