# Resource Access Authorizer

`ResourceAccessAuthorizer` is a frontend-only authorization flow for any protected resource. It performs no API calls and has no dependency on `resource_access` transport details. The consumer owns the initial decision and all verification or purchase work.

## Usage

```jsx
<ResourceAccessAuthorizer
  resource={{
    type: "attachment",
    id: attachment.id,
    name: attachment.name,
    context: { folderId },
  }}
  decision={accessDecision}
  onPasswordVerifying={async ({ resource, condition, password }) => {
    return verifyAttachmentPassword(resource, condition, password);
  }}
  onFinalizing={async ({ resource }) => {
    return finalizeAttachmentAccess(resource);
  }}
>
  {({ authorize, authorizing }) => (
    <button
      type="button"
      disabled={authorizing}
      onClick={async () => {
        if (await authorize()) openAttachment(attachment);
      }}
    >
      Open
    </button>
  )}
</ResourceAccessAuthorizer>
```

## Props

| Prop                  | Required | Purpose                                                                                                         |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `resource`            | Yes      | `{ type, id, name, context? }`; application types are `article`, `book`, and `attachment`.                     |
| `decision`            | Yes      | Current complete access decision. The caller refreshes this prop when its external state changes.               |
| `onPasswordVerifying` | No       | Receives `{ resource, decision, condition, password }`; returns a complete next decision.                       |
| `onFinalizing`        | No       | Receives `{ resource, decision }`; performs the final money settlement and returns the complete final decision. |
| `onAuthorized`        | No       | Observes an immediate grant or a user-confirmed Enter action.                                                   |
| `onRejected`          | No       | Observes main-gate dismissal, unsupported action, or invalid decision.                                          |
| `autoOpen`            | No       | Opens the authorization gate on mount; used by the application-level provider.                                  |
| `allowCancel`         | No       | Defaults to `true`. When `false`, the main authorization gate cannot be dismissed by its controls, backdrop, or Escape. |
| `children`            | Yes      | Render function receiving `{ authorize, authorizing, resource, decision }`, or static content.                  |

`decision.allGranted` is the only aggregate authorization result. Password verification and finalization callbacks must return a new _complete_ decision rather than updating a row locally.

```js
const accessDecision = {
  allGranted: false,
  label: "Design archive",
  isVip: true,
  conditions: [
    {
      id: "password",
      type: "encrypted",
      status: "pending",
      action: "password",
      requirement: "Password",
    },
    {
      id: "price",
      type: "money",
      status: "purchase_required",
      action: "purchase",
      requirement: 20,
    },
  ],
};
```

The built-in presentation recognizes `money`, `points`, `encrypted`, and `book_only`. Other types, statuses, and actions render safely as non-granting informational rows. The component does not modify cards, pages, routes, or business state.

Canceling or closing a password/purchase child modal only returns to the main authorization table. Closing the main gate is what resolves `authorize()` as `false`.

## Application integration

For application code, prefer the `ResourceAccessProvider` and `useResourceAccess()` hook instead of duplicating API checks at each resource entry point:

```jsx
const { authorizeResource } = useResourceAccess();

const allowed = await authorizeResource({
  type: "article",
  id: article.id,
  name: article.title,
  context: { inBook: false },
});

if (allowed) navigate(`/articles/${article.id}`);
```

Pass `{ allowCancel: false }` as the second argument to require the user to complete the main authorization gate before the request can resolve:

```js
await authorizeResource(resource, { allowCancel: false });
```

The provider owns calls to `resource_access`, maps its snake-case response to this component's decision format, invokes password verification and final-access settlement endpoints, and refreshes the authenticated user after a successful settlement. It deliberately leaves the server to select the effective `common` or `vip` authorization channel.
