import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Agents from "./pages/Agents";
import Agent from "./pages/Agent";
import Chats from "./pages/Chats";
import Chat from "./pages/Chat";
import Message from "./pages/Message";
import Models from "./pages/Models";
import Model from "./pages/Model";
import Tools from "./pages/Tools";
import Tool from "./pages/Tool";
import Traces from "./pages/Traces";
import Settings from "./pages/Settings";
import Logout from "./pages/Logout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:id" element={<Agent />} />
            <Route path="/chats" element={<Chats />} />
            <Route path="/chats/:id" element={<Chat />} />
            <Route path="/chats/:id/messages/:messageId" element={<Message />} />
            <Route path="/models" element={<Models />} />
            <Route path="/models/:id" element={<Model />} />
            <Route path="/tools" element={<Tools />} />
            <Route path="/tools/:id" element={<Tool />} />
            <Route path="/traces" element={<Traces />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/" element={<Agents />} />
          </Routes>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
