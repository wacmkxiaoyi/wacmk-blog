import React from "react";
import Input from "../../../../components/ui/Input.jsx";
import Button from "../../../../components/ui/Button.jsx";
import { AddIcon } from "../../../../packages/editor/react/icons/index.ts";
import type {
  EditorCustomBlockRenderProps,
  EditorToolDefinition,
} from "../../../../packages/editor/core/index.ts";

function EmailFormBlock(props: EditorCustomBlockRenderProps) {
  const [email, setEmail] = React.useState("");
  const [submittedEmail, setSubmittedEmail] = React.useState("");
  const title = String(props.data.title || "Newsletter signup");
  const description = String(
    props.data.description ||
      "Capture a test email without touching the editor internals.",
  );
  const label = String(props.data.label || "Email");
  const placeholder = String(props.data.placeholder || "name@example.com");
  const buttonText = String(props.data.buttonText || "Submit");

  return (
    <div
      className="editor-test-email-form"
      data-editor-email-form-kind={props.kind}
    >
      <div className="editor-test-email-form__header">
        <p className="editor-test-email-form__eyebrow">External Tool</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="editor-test-email-form__body">
        <Input
          type="email"
          label={label}
          placeholder={placeholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="editor-test-email-form__actions">
          <Button
            onClick={() => setSubmittedEmail(email)}
            disabled={!email.trim()}
          >
            {buttonText}
          </Button>
          <span className="editor-test-email-form__status">
            {submittedEmail
              ? `Pretend submitted: ${submittedEmail}`
              : "No real request is sent."}
          </span>
        </div>
      </div>
    </div>
  );
}

export function createEmailFormTool(): EditorToolDefinition {
  return {
    key: "email-form",
    name: "Email Form",
    icon: <AddIcon />,
    group: 3,
    order: 4,
    markdownInsert:
      '::custom{kind="email-form" title="Newsletter signup" description="Capture a test email without touching the editor internals." label="Email" placeholder="name@example.com" buttonText="Submit"}',
    customBlock: {
      kind: "email-form",
      data: {
        title: "Newsletter signup",
        description:
          "Capture a test email without touching the editor internals.",
        label: "Email",
        placeholder: "name@example.com",
        buttonText: "Submit",
      },
      createData() {
        return {
          title: "Newsletter signup",
          description:
            "Capture a test email without touching the editor internals.",
          label: "Email",
          placeholder: "name@example.com",
          buttonText: "Submit",
        };
      },
      render: EmailFormBlock,
      getContextMenuGroups({ data, updateData }) {
        return [
          {
            group: 20,
            children: [
              {
                key: "email-form-rename",
                label: "Rename button",
                onClick: () =>
                  updateData({
                    ...data,
                    buttonText:
                      String(data.buttonText || "Submit") === "Submit"
                        ? "Preview submit"
                        : "Submit",
                  }),
              },
              {
                key: "email-form-swap-copy",
                label: "Swap placeholder",
                onClick: () =>
                  updateData({
                    ...data,
                    placeholder:
                      String(data.placeholder || "name@example.com") ===
                      "name@example.com"
                        ? "team@company.com"
                        : "name@example.com",
                  }),
              },
            ],
          },
        ];
      },
    },
  };
}
