import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Agents from "./pages/Agents";
import Chats from "./pages/Chats";
import Models from "./pages/Models";
import Tools from "./pages/Tools";
import Traces from "./pages/Traces";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Agents />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/models" element={<Models />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/traces" element={<Traces />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
