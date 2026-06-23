/* eslint-disable */
/* oxlint-disable react-doctor/prefer-useReducer, react-doctor/no-giant-component */
import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  ConnectionMode,
  Node,
  Edge,
  OnSelectionChangeParams,
  Panel,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Settings, Volume2, CornerDownLeft, HeadphonesIcon, GitFork, Zap, Tag, PhoneForwarded, Bell, Play, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { getCampaignFlow, saveCampaignFlow } from '../lib/api';

import BotSpeakNode from './nodes/BotSpeakNode';
import BotListenNode from './nodes/BotListenNode';
import BotActionNode from './nodes/BotActionNode';
import CampaignWizardModal from './CampaignWizardModal';
import NodeEditModal from './nodes/NodeEditModal';

const nodeTypes = {
  botSpeak: BotSpeakNode,
  botListen: BotListenNode,
  botAction: BotActionNode,
};

const initialNodes: Node[] = [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 450, y: 50 },
    data: { label: 'Cuộc gọi bắt đầu' }
  }
];

const initialEdges: Edge[] = [];

interface FlowBuilderProps {
  campaignId?: string;
}

export default function FlowBuilder({ campaignId = 'main_campaign' }: FlowBuilderProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [collapseHoiThoai, setCollapseHoiThoai] = useState(false);
  const [collapseHanhDong, setCollapseHanhDong] = useState(false);

  // Refs update on every render to ensure latest state is accessed by saveFlow without re-binding listener
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    let cancelled = false;
    const loadFlow = async () => {
      try {
        const data = await getCampaignFlow(campaignId);
        if (cancelled) return;
        if (data.nodes || data.edges) {
          setNodes(data.nodes ? JSON.parse(data.nodes) : initialNodes);
          setEdges(data.edges ? JSON.parse(data.edges) : initialEdges);
        } else {
          setNodes(initialNodes);
          setEdges(initialEdges);
        }
      } catch (err) {
        console.error("Lỗi khi tải Kịch bản:", err);
        if (!cancelled) {
          setNodes(initialNodes);
          setEdges(initialEdges);
        }
      }
    };
    loadFlow();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const saveFlow = async () => {
    setIsSaving(true);
    try {
      const currentNodes = JSON.stringify(nodesRef.current);
      const currentEdges = JSON.stringify(edgesRef.current);

      await saveCampaignFlow(campaignId, {
        nodes: currentNodes,
        edges: currentEdges,
      });
      setShowWizard(true); // Mở popup bước 2
    } catch (err) {
      console.error("Lỗi lưu Kịch bản:", err);
      alert("Lưu thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleSave = () => {
      saveFlow();
    };
    document.addEventListener('saveCampaign', handleSave);
    return () => document.removeEventListener('saveCampaign', handleSave);
  }, []);

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', style: { strokeWidth: 2, stroke: '#000' } }, eds)),
    []
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.nodes.length > 0) {
       setSelectedNode(params.nodes[0]);
    } else {
       setSelectedNode(null);
    }
  }, []);

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setEditingNode(node);
    setIsEditModalOpen(true);
  }, []);

  const handleUpdateNodeData = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: newData };
        }
        return node;
      })
    );
  };

  const handleDeleteNode = (id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setSelectedNode(null);
  };

  const handleAddNode = (type: string, defaults: any) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: defaults
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes]);

  return (
    <div className="flex size-full">
      <div className="flex-1 relative bg-zinc-50/50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Background gap={16} size={1} color="#e5e7eb" />
          <Controls showInteractive={false} className="bg-white border-zinc-200 shadow-md rounded-lg overflow-hidden" />
          
          <Panel position="top-right" className="m-4 z-50">
             <button onClick={saveFlow} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-md disabled:opacity-50">
               <Save size={16} /> {isSaving ? "Đang lưu..." : "Lưu kịch bản Server"}
             </button>
          </Panel>

          <Panel position="top-left" className="bg-white p-3 rounded-xl shadow-lg border border-zinc-200 w-56 my-4 mx-4 flex flex-col gap-4">
             <div>
               <button 
                 onClick={() => setCollapseHoiThoai(!collapseHoiThoai)}
                 className="w-full flex items-center justify-between mb-2 group text-left outline-none"
               >
                 <h4 className="text-[10px] font-semibold text-teal-500 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none">
                   <div className="size-2 rounded-full bg-teal-400"></div> Hội Thoại
                 </h4>
                 {collapseHoiThoai ? <ChevronRight size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
               </button>
               
               {!collapseHoiThoai && (
                <div className="space-y-1.5 duration-200">
                   <button onClick={() => handleAddNode('botSpeak', { text: "Nội dung bot nói..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <Volume2 size={16} /> Bot Nói
                   </button>
                   <button onClick={() => handleAddNode('botSpeak', { isRetry: true, text: "Em chưa nghe rõ ạ..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <CornerDownLeft size={16} /> Bot Nói Lại
                   </button>
                   <button onClick={() => handleAddNode('botListen', { intentName: "ý định mới", branches: [{ keywords: ["từ khóa 1"] }] })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <HeadphonesIcon size={16} /> Bot Nghe
                   </button>
                   <button onClick={() => handleAddNode('botListen', { intentName: "ivr", branches: [{ keywords: ["phím 1"] }, { keywords: ["phím 2"] }] })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <GitFork size={16} /> IVR
                   </button>
                   <button onClick={() => handleAddNode('botAction', { actionType: 'trigger', placeholder: "Nhập endpoint API kích hoạt..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <Zap size={16} /> Kích hoạt
                   </button>
                </div>
               )}
             </div>

             <div>
               <button 
                 onClick={() => setCollapseHanhDong(!collapseHanhDong)}
                 className="w-full flex items-center justify-between mb-2 group text-left outline-none"
               >
                 <h4 className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none">
                   <div className="size-2 rounded-full bg-amber-400"></div> Hành Động
                 </h4>
                 {collapseHanhDong ? <ChevronRight size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
               </button>

               {!collapseHanhDong && (
                <div className="space-y-1.5 duration-200">
                   <button onClick={() => handleAddNode('botAction', { actionType: 'label', placeholder: "Nhập tag CRM..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <Tag size={16} /> Gắn nhãn
                   </button>
                   <button onClick={() => handleAddNode('botAction', { actionType: 'transfer', placeholder: "Nhập số ext hoặc SIP..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <PhoneForwarded size={16} /> Chuyển máy
                   </button>
                   <button onClick={() => handleAddNode('botAction', { actionType: 'notify', placeholder: "Nhập webhook/nội dung thông báo..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <Bell size={16} /> Thông báo
                   </button>
                   <button onClick={() => handleAddNode('botAction', { actionType: 'start', placeholder: "Tham số bắt đầu..." })} className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 rounded-lg text-sm text-zinc-700 transition-colors">
                      <Play size={16} /> Bắt đầu
                   </button>
                </div>
               )}
             </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right Sidebar for AI Logic */}
      <div className="w-80 bg-white border-l border-zinc-200 shadow-sm flex flex-col z-20 overflow-y-auto shrink-0">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-zinc-800">Cấu hình AI (Node Config)</h3>
            <p className="text-xs text-zinc-500">Machine-readable data cho luồng này</p>
          </div>
          {selectedNode && (
             <button onClick={deleteSelectedNode} className="p-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors font-medium border border-red-200">
                Xóa thẻ
             </button>
          )}
        </div>
        {selectedNode ? (
          <div className="p-5 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Mục tiêu (Goal)</label>
                <input type="text" className="w-full border border-zinc-300 rounded p-2 text-sm bg-violet-50/50 border-violet-200 focus:outline-none focus:ring-1 focus:ring-violet-500 text-zinc-800" defaultValue={selectedNode.data.goal as string || (selectedNode.type === 'botSpeak' ? "Truyền đạt thông tin" : "Thu thập Context")} />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Hành động (Action)</label>
                <input type="text" className="w-full border border-zinc-300 rounded p-2 text-sm text-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500" defaultValue={selectedNode.data.action as string || (selectedNode.type === 'botSpeak' ? "Kích hoạt Text-to-Speech" : "Chờ User Input")} />
              </div>
              {selectedNode.type === 'botListen' && (
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Từ khóa nhánh (Keywords)</label>
                  <textarea className="w-full border border-zinc-300 rounded p-2 text-sm h-16 text-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500" defaultValue={"có, được, gửi thông tin, bao nhiêu, giá, tư vấn"} />
                </div>
              )}
            </div>

            <div className="border-t border-zinc-200 pt-5 space-y-4">
              <h4 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">Nâng cấp AI (Advanced)</h4>
              <div>
                <label className="text-xs font-bold text-zinc-500 mb-1 block">Trigger Condition</label>
                <input type="text" className="w-full border border-zinc-300 rounded p-2 text-sm font-mono text-xs text-orange-600 focus:outline-none bg-zinc-50" defaultValue="if(confidence_score > 0.85)" />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 mb-1 block">Output Format (Dữ liệu trả về)</label>
                <textarea className="w-full border border-zinc-300 rounded p-2 text-sm font-mono text-xs text-blue-600 h-24 bg-zinc-50 focus:outline-none" defaultValue={`{\n  "step": "active_listening",\n  "intent": "{intent_name}",\n  "extracted_data": "{data}"\n}`} />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 mb-1 block">Tool Usage (Sử dụng API Platform)</label>
                <select defaultValue="Lưu Data vào CRM System" className="w-full border border-zinc-300 rounded p-2 text-sm text-zinc-800 focus:outline-none">
                    <option>Không dùng API external</option>
                    <option>Lưu Data vào CRM System</option>
                    <option>Gửi tin nhắn Zalo ZNS</option>
                    <option>Chuyển hướng cuộc gọi (Transfer)</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-400 flex flex-col items-center mt-10">
            <div className="size-16 rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center mb-3">
              <Settings className="text-zinc-300" size={24} />
            </div>
            <p className="text-sm font-medium text-zinc-600">Chưa chọn Node trên Map</p>
            <p className="text-xs mt-1 leading-relaxed">Vui lòng click vào một thẻ hộp thoại trên Canvas để cấu hình khung tư duy AI chi tiết cho đoạn gọi đó.</p>
          </div>
        )}
      </div>
      
      {/* Node Editor Modal */}
      <NodeEditModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        node={editingNode} 
        onSave={handleUpdateNodeData}
        onDelete={handleDeleteNode}
      />
      
      {/* Wizard Modal */}
      <CampaignWizardModal isOpen={showWizard} onClose={() => setShowWizard(false)} campaignId={campaignId} />
    </div>
  );
}
