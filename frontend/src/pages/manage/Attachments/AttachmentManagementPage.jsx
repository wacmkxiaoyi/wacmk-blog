import useI18n from "../../../hooks/useI18n";
import AttachmentTable from "../../../components/attachment-manager/AttachmentTable";
import api from "../../../api";
import ManageSidebar from "../ManageSidebar";
import "../../../components/attachment-manager/AttachmentTable.css";
import "../Basic/BasicSettingsPage.css";
import "./AttachmentManagementPage.css";

export default function AttachmentManagementPage() {
  const { t } = useI18n();
  return (
    <main className="manage-page">
      <ManageSidebar active="attachments" />
      <section className="manage-content">
        <div className="settings-shell managed-attachments-shell">
          <header className="settings-heading">
            <div>
              <span>{t("attachment.managementKicker")}</span>
              <h1>{t("attachment.managementTitle")}</h1>
              <p>{t("attachment.managementDescription")}</p>
            </div>
          </header>
          <AttachmentTable
            fetchData={api.manage.listAttachments}
            updateAttachment={api.manage.updateAttachment}
            deleteAttachment={api.manage.deleteAttachment}
            requestDownload={api.resources.requestStandaloneAttachmentDownload}
            includeUploader
          />
        </div>
      </section>
    </main>
  );
}
