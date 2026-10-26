import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import AuthProvider from "./contexts/AuthContext";
import ResourceAccessProvider from "./contexts/ResourceAccessContext";
import I18nProvider from "./i18n/I18nContext";
import SiteRuntimeProvider from "./contexts/SiteRuntimeContext";
import { ModalProvider } from "./packages/modal";
import useAuth from "./hooks/useAuth";
import useSiteRuntime from "./hooks/useSiteRuntime";
import {
  buildLoginRedirectPath,
  getPostAuthRedirectPath,
} from "./utils/authRedirect";
import LoginPage from "./pages/auth/Login/LoginPage";
import RegisterPage from "./pages/auth/Register/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPassword/ForgotPasswordPage";
import HomePage from "./pages/app/Home/HomePage";
import TagsPage from "./pages/app/Tags/TagsPage";
import ArticlesPage from "./pages/app/Articles/ArticlesPage";
import BooksPage from "./pages/app/Books/BooksPage";
import ArticleDetailPage from "./pages/app/ArticleDetail/ArticleDetailPage";
import BookDetailPage from "./pages/app/BookDetail/BookDetailPage";
import ModalTestPage from "./pages/playground/packages/modal/ModalTestPage";
import ContextActionsTestPage from "./pages/playground/packages/context-actions/ContextActionsTestPage";
import TableTestPage from "./pages/playground/packages/table/TableTestPage";
import ContentRendererTestPage from "./pages/playground/packages/content-renderer/ContentRendererTestPage";
import EditorTestPage from "./pages/playground/packages/editor/EditorTestPage";
import CatalogManagerTestPage from "./pages/playground/packages/catalog-manager/CatalogManagerTestPage";
import CardTestPage from "./pages/playground/packages/card/CardTestPage";
import TooltipTestPage from "./pages/playground/packages/tooltip/TooltipTestPage";
import CommentsTestPage from "./pages/playground/packages/comments/CommentsTestPage";
import ArticleTagTestPage from "./pages/playground/components/article-tag/ArticleTagTestPage";
import AccessTagTestPage from "./pages/playground/components/access-tag/AccessTagTestPage";
import ArticleCardTestPage from "./pages/playground/components/article-card/ArticleCardTestPage";
import BookCardTestPage from "./pages/playground/components/book-card/BookCardTestPage";
import ResourceAccessAuthorizerTestPage from "./pages/playground/components/resource-access-authorizer/ResourceAccessAuthorizerTestPage";
import ContentTemplateTestPage from "./pages/playground/utils/ContentTemplateTestPage";
import BasicSettingsPage from "./pages/manage/Basic/BasicSettingsPage";
import AuditLogPage from "./pages/manage/Audit/AuditLogPage";
import UserManagementPage from "./pages/manage/Users/UserManagementPage";
import ArticleManagementPage from "./pages/manage/Articles/ArticleManagementPage";
import BookManagementPage from "./pages/manage/Books/BookManagementPage";
import BookEditorPage from "./pages/manage/Books/BookEditorPage";
import ArticleEditorPage from "./features/article-editor/ArticleEditorPage";
import NewArticlePage from "./features/article-editor/NewArticlePage";
import AttachmentManagementPage from "./pages/manage/Attachments/AttachmentManagementPage";
import ProfilePage from "./pages/profile/ProfilePage";
import NamecardPage from "./pages/namecard/NamecardPage";
import ExternalArticlePage from "./pages/external-link/ExternalArticlePage";
import ExternalBookPage from "./pages/external-link/ExternalBookPage";
import AppLayout from "./components/layout/AppLayout";
import "./App.css";

function AuthGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={buildLoginRedirectPath(location)} replace />;
  }

  return children;
}

function GuestGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getPostAuthRedirectPath(location.search)} replace />;
  }

  return children;
}

function ManagerGuard({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
      </div>
    );
  }

  if (!user?.is_staff && !user?.is_superuser) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

function RegistrationGuard({ children }) {
  const { config, loading } = useSiteRuntime();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading__spinner" />
      </div>
    );
  }

  if (config?.registration?.enable_register !== true) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <GuestGuard>
            <LoginPage />
          </GuestGuard>
        }
      />
      <Route
        path="/register"
        element={
          <GuestGuard>
            <RegistrationGuard>
              <RegisterPage />
            </RegistrationGuard>
          </GuestGuard>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestGuard>
            <ForgotPasswordPage />
          </GuestGuard>
        }
      />
      <Route
        path="/external-link/articles/:token"
        element={<ExternalArticlePage />}
      />
      <Route
        path="/external-link/books/:token"
        element={<ExternalBookPage />}
      />
      <Route
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/home" element={<HomePage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:slug" element={<ArticleDetailPage />} />
        <Route path="/drafts/:slug" element={<ArticleDetailPage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/:slug" element={<BookDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/profile/articles/new"
          element={<NewArticlePage profile />}
        />
        <Route
          path="/profile/articles/drafts/:slug/edit"
          element={<ArticleEditorPage profile />}
        />
        <Route
          path="/profile/articles/:slug/edit"
          element={<ArticleEditorPage profile published />}
        />
        <Route path="/profile/books/new" element={<BookEditorPage profile />} />
        <Route
          path="/profile/books/:slug/edit"
          element={<BookEditorPage profile />}
        />
        <Route path="/users/:userId/namecard" element={<NamecardPage />} />
        <Route
          path="/manage/users"
          element={
            <ManagerGuard>
              <UserManagementPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/basic"
          element={
            <ManagerGuard>
              <BasicSettingsPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/audit"
          element={
            <ManagerGuard>
              <AuditLogPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/articles"
          element={
            <ManagerGuard>
              <ArticleManagementPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/articles/new"
          element={
            <ManagerGuard>
              <NewArticlePage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/articles/drafts/:slug/edit"
          element={
            <ManagerGuard>
              <ArticleEditorPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/articles/:slug/edit"
          element={
            <ManagerGuard>
              <ArticleEditorPage published />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/books"
          element={
            <ManagerGuard>
              <BookManagementPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/books/new"
          element={
            <ManagerGuard>
              <BookEditorPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/books/:slug/edit"
          element={
            <ManagerGuard>
              <BookEditorPage />
            </ManagerGuard>
          }
        />
        <Route
          path="/manage/attachments"
          element={
            <ManagerGuard>
              <AttachmentManagementPage />
            </ManagerGuard>
          }
        />
      </Route>
      <Route
        path="/test/frontend/packages/modal"
        element={
          <AuthGuard>
            <ModalTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/context-actions"
        element={
          <AuthGuard>
            <ContextActionsTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/content-renderer"
        element={
          <AuthGuard>
            <ContentRendererTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/table"
        element={
          <AuthGuard>
            <TableTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/editor"
        element={
          <AuthGuard>
            <EditorTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/utils/content-template"
        element={
          <AuthGuard>
            <ContentTemplateTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/catalog-manager"
        element={
          <AuthGuard>
            <CatalogManagerTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/card"
        element={
          <AuthGuard>
            <CardTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/tooltip"
        element={
          <AuthGuard>
            <TooltipTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/packages/comments"
        element={
          <AuthGuard>
            <CommentsTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/components/article-tag"
        element={
          <AuthGuard>
            <ArticleTagTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/components/access-tag"
        element={
          <AuthGuard>
            <AccessTagTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/components/article-card"
        element={
          <AuthGuard>
            <ArticleCardTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/components/book-card"
        element={
          <AuthGuard>
            <BookCardTestPage />
          </AuthGuard>
        }
      />
      <Route
        path="/test/frontend/components/resource-access-authorizer"
        element={
          <AuthGuard>
            <ResourceAccessAuthorizerTestPage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <SiteRuntimeProvider>
          <ModalProvider>
            <AuthProvider>
              <ResourceAccessProvider>
                <AppRoutes />
              </ResourceAccessProvider>
            </AuthProvider>
          </ModalProvider>
        </SiteRuntimeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
