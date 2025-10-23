import { X, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState } from 'react';
import { AgentCard } from './AgentCard';
import { ThreadCard } from './ThreadCard';
import type { AgentRecord } from '@/types/agent';
import type { ThemeSettings } from './SidebarMenu';

interface ModernSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentRecord[];
  selectedAgent: AgentRecord | null;
  onAgentChange: (agentId: string) => void;
  threads: any[];
  currentThreadId: string | null;
  onThreadChange: (threadId: string) => void;
  themeSettings: ThemeSettings;
  onThemeChange: (settings: Partial<ThemeSettings>) => void;
  agentDetails?: AgentRecord | null;
  loadingAgentDetails?: boolean;
}

export const ModernSidebar = ({
  isOpen,
  onClose,
  agents,
  selectedAgent,
  onAgentChange,
  threads,
  currentThreadId,
  onThreadChange,
  themeSettings,
  onThemeChange,
  agentDetails,
  loadingAgentDetails,
}: ModernSidebarProps) => {
  const [expandedTheme, setExpandedTheme] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState(true);
  const [expandedAgentDetails, setExpandedAgentDetails] = useState(true);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-96 bg-card border-r shadow-lg z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground border border-border"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-88px)] overflow-y-auto p-6 space-y-6">
          {/* Agents Section */}
          <div className="space-y-3">
            <button
              onClick={() => setExpandedAgents(!expandedAgents)}
              className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
            >
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Agents</h3>
              {expandedAgents ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {expandedAgents && (
              <>
                <div className="grid gap-3">{agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={selectedAgent?.id === agent.id}
                    onClick={() => onAgentChange(agent.id)}
                  />
                ))}
              </div>

            {/* Agent Details Section */}
            {expandedAgents && selectedAgent && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setExpandedAgentDetails(!expandedAgentDetails)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Agent Details</span>
                  </div>
                  {expandedAgentDetails ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </button>

                {expandedAgentDetails && agentDetails && (
                  <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                    {loadingAgentDetails ? (
                      <div className="text-center text-muted-foreground text-sm py-4">Loading details...</div>
                    ) : (
                      <>
                        {agentDetails.model && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium">Model</div>
                            <div className="text-sm text-foreground font-mono bg-muted/50 p-2 rounded border">{agentDetails.model}</div>
                          </div>
                        )}

                        {agentDetails.instructions && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium">Instructions</div>
                            <div className="text-sm text-foreground bg-muted/50 p-2 rounded border max-h-32 overflow-y-auto">
                              {agentDetails.instructions}
                            </div>
                          </div>
                        )}

                        {agentDetails.tool_ids && agentDetails.tool_ids.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium">Tools ({agentDetails.tool_ids.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {agentDetails.tool_ids.map((toolId) => (
                                <span key={toolId} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
                                  {toolId.split('.').pop()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agentDetails.handoff_ids && agentDetails.handoff_ids.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium">Handoffs ({agentDetails.handoff_ids.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {agentDetails.handoff_ids.map((handoffId) => (
                                <span key={handoffId} className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-full border border-secondary/20">
                                  {handoffId.slice(0, 8)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {agentDetails.model_settings && Object.keys(agentDetails.model_settings).length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground font-medium">Model Settings</div>
                            <pre className="text-xs text-foreground bg-muted/50 p-2 rounded border overflow-x-auto">
                              {JSON.stringify(agentDetails.model_settings, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-1 pt-2 border-t">
                          <div className="text-xs text-muted-foreground font-medium">Created</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(agentDetails.created_at).toLocaleString()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
              </>
            )}
          </div>

          {/* Threads Section */}
          <div className="space-y-3 pt-6 border-t">
            <button
              onClick={() => setExpandedThreads(!expandedThreads)}
              className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
            >
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Chat Threads</h3>
              {expandedThreads ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {expandedThreads && (
              <div className="space-y-2">
                <ThreadCard isNewThread onClick={() => onThreadChange('')} isActive={!currentThreadId} />
                {threads.slice(0, 5).map((thread) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === currentThreadId}
                    onClick={() => onThreadChange(thread.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Theme Settings */}
          <div className="space-y-3 pt-6 border-t">
            <button
              onClick={() => setExpandedTheme(!expandedTheme)}
              className="w-full flex items-center justify-between hover:opacity-70 transition-opacity"
            >
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Theme</h3>
              {expandedTheme ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </button>

            {expandedTheme && (
              <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                {/* Color Scheme */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Color Scheme</label>
                  <div className="flex gap-2">
                    {(['dark', 'light'] as const).map((scheme) => (
                      <button
                        key={scheme}
                        onClick={() => onThemeChange({ colorScheme: scheme })}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                          themeSettings.colorScheme === scheme
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-accent'
                        }`}
                      >
                        {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Accent Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={themeSettings.accentColor}
                      onChange={(e) => onThemeChange({ accentColor: e.target.value })}
                      className="w-full h-12 rounded-lg border-2 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-foreground font-mono font-medium">{themeSettings.accentColor}</span>
                  </div>
                </div>

                {/* Radius */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Border Radius</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['sharp', 'soft', 'round', 'pill'] as const).map((radius) => (
                      <button
                        key={radius}
                        onClick={() => onThemeChange({ radius })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                          themeSettings.radius === radius
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-accent'
                        }`}
                      >
                        {radius.charAt(0).toUpperCase() + radius.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Density */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Density</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['compact', 'normal', 'spacious'] as const).map((density) => (
                      <button
                        key={density}
                        onClick={() => onThemeChange({ density })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium transition-all border ${
                          themeSettings.density === density
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-accent'
                        }`}
                      >
                        {density.charAt(0).toUpperCase() + density.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
