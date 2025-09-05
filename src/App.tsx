import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Agents from "./pages/Agents";
import Chats from "./pages/Chats";
import Models from "./pages/Models";
import Tools from "./pages/Tools";
import Traces from "./pages/Traces";
import Settings from "./pages/Settings";
import Logout from "./pages/Logout";

setupIonicReact({
  mode: 'md' // Use Material Design mode for consistent look
});

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <IonApp>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <IonRouterOutlet>
            <Routes>
              <Route path="/agents" element={<Agents />} />
              <Route path="/chats" element={<Chats />} />
              <Route path="/models" element={<Models />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/traces" element={<Traces />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/" element={<Agents />} />
            </Routes>
          </IonRouterOutlet>
        </BrowserRouter>
      </IonApp>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
