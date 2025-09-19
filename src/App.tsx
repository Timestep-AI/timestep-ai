import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Agents from "./pages/Agents";
import Agent from "./pages/Agent";
import ModelProviders from "./pages/ModelProviders";
import ToolProviders from "./pages/ToolProviders";
import Chats from "./pages/Chats";
import Chat from "./pages/Chat";
import Message from "./pages/Message";
import Models from "./pages/Models";
import Model from "./pages/Model";
import Tools from "./pages/Tools";
import Tool from "./pages/Tool";
import Traces from "./pages/Traces";
import TracePage from "./pages/Trace";

import MCPServerDetails from "./pages/MCPServerDetails";
import ModelProviderDetails from "./pages/ModelProviderDetails";
import AdminModelProviders from "./pages/admin/ModelProviders";
import AdminModelProviderDetails from "./pages/admin/ModelProviderDetails";
import AdminToolProviders from "./pages/admin/ToolProviders";
import AdminToolProviderDetails from "./pages/admin/ToolProviderDetails";
import AdminUserSettings from "./pages/admin/UserSettings";
import Logout from "./pages/Logout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/agents" element={<AuthGuard><Agents /></AuthGuard>} />
              <Route path="/agents/:id" element={<AuthGuard><Agent /></AuthGuard>} />
              <Route path="/model_providers" element={<AuthGuard><ModelProviders /></AuthGuard>} />
              <Route path="/tool_providers" element={<AuthGuard><ToolProviders /></AuthGuard>} />
              <Route path="/chats" element={<AuthGuard><Chats /></AuthGuard>} />
              <Route path="/chats/:id" element={<AuthGuard><Chat /></AuthGuard>} />
              <Route path="/chats/:id/messages/:messageId" element={<AuthGuard><Message /></AuthGuard>} />
              <Route path="/models" element={<AuthGuard><Models /></AuthGuard>} />
              <Route path="/models/:id" element={<AuthGuard><Model /></AuthGuard>} />
              <Route path="/tools" element={<AuthGuard><Tools /></AuthGuard>} />
              <Route path="/tools/:id" element={<AuthGuard><Tool /></AuthGuard>} />
              <Route path="/traces" element={<AuthGuard><Traces /></AuthGuard>} />
              <Route path="/traces/:id" element={<AuthGuard><TracePage /></AuthGuard>} />
              <Route path="/tool_providers/:id" element={<AuthGuard><MCPServerDetails /></AuthGuard>} />
              <Route path="/model_providers/:id" element={<AuthGuard><ModelProviderDetails /></AuthGuard>} />
              <Route path="/admin/model_providers" element={<AuthGuard><AdminModelProviders /></AuthGuard>} />
              <Route path="/admin/model_providers/:id" element={<AuthGuard><AdminModelProviderDetails /></AuthGuard>} />
              <Route path="/admin/tool_providers" element={<AuthGuard><AdminToolProviders /></AuthGuard>} />
              <Route path="/admin/tool_providers/:id" element={<AuthGuard><AdminToolProviderDetails /></AuthGuard>} />
              <Route path="/admin/user_settings" element={<AuthGuard><AdminUserSettings /></AuthGuard>} />
              <Route path="/logout" element={<AuthGuard><Logout /></AuthGuard>} />
              <Route path="/" element={<AuthGuard><Agents /></AuthGuard>} />
            </Routes>
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
