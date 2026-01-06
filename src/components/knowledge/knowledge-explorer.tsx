'use client';

import { FileText, GitPullRequest, Maximize2, Minimize2, Search, User, Video, ZoomIn, ZoomOut } from 'lucide-react';
import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Types for the knowledge graph
interface GraphNode {
  id: string;
  type: 'person' | 'topic' | 'artifact' | 'decision' | 'video';
  label: string;
  metadata?: Record<string, unknown>;
  // Position for force-directed layout
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  weight?: number;
}

interface KnowledgeExplorerProps {
  organizationId: string;
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
  onDecisionClick?: (decisionId: string) => void;
}

// Node colors by type
const NODE_COLORS: Record<GraphNode['type'], { fill: string; stroke: string }> = {
  person: { fill: '#dbeafe', stroke: '#3b82f6' },
  topic: { fill: '#dcfce7', stroke: '#22c55e' },
  artifact: { fill: '#fef3c7', stroke: '#f59e0b' },
  decision: { fill: '#f3e8ff', stroke: '#a855f7' },
  video: { fill: '#fee2e2', stroke: '#ef4444' },
};

// Node icons by type
const NodeIcon: React.FC<{ type: GraphNode['type']; className?: string }> = ({ type, className }) => {
  const iconClass = cn('h-4 w-4', className);
  switch (type) {
    case 'person':
      return <User className={iconClass} />;
    case 'topic':
      return <FileText className={iconClass} />;
    case 'artifact':
      return <GitPullRequest className={iconClass} />;
    case 'decision':
      return <FileText className={iconClass} />;
    case 'video':
      return <Video className={iconClass} />;
  }
};

// Simple force-directed layout simulation
function useForceSimulation(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<GraphNode[]>([]);

  useEffect(() => {
    if (nodes.length === 0) return;

    // Initialize node positions
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      const existing = nodesRef.current.find((n) => n.id === node.id);
      const newNode: GraphNode = {
        ...node,
        x: existing?.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: existing?.y ?? height / 2 + (Math.random() - 0.5) * 200,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: null,
        fy: null,
      };
      nodeMap.set(node.id, newNode);
    }
    nodesRef.current = Array.from(nodeMap.values());

    // Create edge lookup for faster access
    const edgeLookup = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!edgeLookup.has(edge.sourceNodeId)) {
        edgeLookup.set(edge.sourceNodeId, new Set());
      }
      if (!edgeLookup.has(edge.targetNodeId)) {
        edgeLookup.set(edge.targetNodeId, new Set());
      }
      edgeLookup.get(edge.sourceNodeId)?.add(edge.targetNodeId);
      edgeLookup.get(edge.targetNodeId)?.add(edge.sourceNodeId);
    }

    // Simulation parameters
    const alpha = 0.3;
    const alphaDecay = 0.02;
    const velocityDecay = 0.6;
    const repulsionStrength = 500;
    const attractionStrength = 0.1;
    const linkDistance = 120;
    const centerStrength = 0.05;

    let currentAlpha = alpha;
    let iteration = 0;
    const maxIterations = 300;

    const simulate = () => {
      if (currentAlpha < 0.001 || iteration >= maxIterations) {
        // Final position update
        const finalPositions = new Map<string, { x: number; y: number }>();
        for (const node of nodesRef.current) {
          finalPositions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
        }
        setPositions(finalPositions);
        return;
      }

      const nodeArray = nodesRef.current;

      // Apply forces
      for (let i = 0; i < nodeArray.length; i++) {
        const node = nodeArray[i];

        // Center force
        const nodeX = node.x ?? 0;
        const nodeY = node.y ?? 0;
        node.vx = (node.vx ?? 0) + (width / 2 - nodeX) * centerStrength * currentAlpha;
        node.vy = (node.vy ?? 0) + (height / 2 - nodeY) * centerStrength * currentAlpha;

        // Repulsion force (between all nodes)
        for (let j = i + 1; j < nodeArray.length; j++) {
          const other = nodeArray[j];
          const otherX = other.x ?? 0;
          const otherY = other.y ?? 0;
          const dx = nodeX - otherX;
          const dy = nodeY - otherY;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          const force = (repulsionStrength * currentAlpha) / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          node.vx = (node.vx ?? 0) + fx;
          node.vy = (node.vy ?? 0) + fy;
          other.vx = (other.vx ?? 0) - fx;
          other.vy = (other.vy ?? 0) - fy;
        }
      }

      // Link force (attraction along edges)
      for (const edge of edges) {
        const source = nodeMap.get(edge.sourceNodeId);
        const target = nodeMap.get(edge.targetNodeId);
        if (!source || !target) continue;

        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - linkDistance) * attractionStrength * currentAlpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx = (source.vx ?? 0) + fx;
        source.vy = (source.vy ?? 0) + fy;
        target.vx = (target.vx ?? 0) - fx;
        target.vy = (target.vy ?? 0) - fy;
      }

      // Apply velocities and boundary constraints
      for (const node of nodeArray) {
        if (node.fx !== null) {
          node.x = node.fx;
        } else {
          node.vx = (node.vx ?? 0) * velocityDecay;
          node.x = (node.x ?? 0) + (node.vx ?? 0);
          // Boundary constraints with padding
          node.x = Math.max(50, Math.min(width - 50, node.x ?? 0));
        }
        if (node.fy !== null) {
          node.y = node.fy;
        } else {
          node.vy = (node.vy ?? 0) * velocityDecay;
          node.y = (node.y ?? 0) + (node.vy ?? 0);
          node.y = Math.max(50, Math.min(height - 50, node.y ?? 0));
        }
      }

      // Update positions for rendering
      const newPositions = new Map<string, { x: number; y: number }>();
      for (const node of nodeArray) {
        newPositions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
      }
      setPositions(newPositions);

      // Decay alpha
      currentAlpha *= 1 - alphaDecay;
      iteration++;

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, edges, width, height]);

  return positions;
}

export function KnowledgeExplorer({ organizationId, className, onNodeClick, onDecisionClick }: KnowledgeExplorerProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<GraphNode['type'] | 'all'>('all');
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Fetch graph data
  useEffect(() => {
    async function fetchGraph() {
      try {
        setLoading(true);
        const params = new URLSearchParams({ organizationId });
        const response = await fetch(`/api/knowledge/graph?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch knowledge graph');
        }
        const data = await response.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchGraph();
  }, [organizationId]);

  // Filter nodes based on search and type
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesSearch = searchQuery === '' || node.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || node.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [nodes, searchQuery, filterType]);

  // Filter edges to only include those between visible nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId));
  }, [edges, filteredNodes]);

  // Run force simulation
  const positions = useForceSimulation(filteredNodes, filteredEdges, dimensions.width, dimensions.height);

  // Handle node click
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node);
      if (node.type === 'decision' && onDecisionClick) {
        onDecisionClick(node.id);
      }
      onNodeClick?.(node);
    },
    [onNodeClick, onDecisionClick],
  );

  // Handle zoom
  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleZoomReset = () => setZoom(1);

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Get connected nodes for selected node
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const connected: GraphNode[] = [];
    for (const edge of edges) {
      if (edge.sourceNodeId === selectedNode.id) {
        const target = nodes.find((n) => n.id === edge.targetNodeId);
        if (target) connected.push(target);
      } else if (edge.targetNodeId === selectedNode.id) {
        const source = nodes.find((n) => n.id === edge.sourceNodeId);
        if (source) connected.push(source);
      }
    }
    return connected;
  }, [selectedNode, edges, nodes]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="animate-pulse text-muted-foreground">Loading knowledge graph...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (nodes.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">No knowledge graph data yet</p>
            <p className="text-sm mt-1">Process some videos to start building the knowledge graph</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Knowledge Explorer</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomReset} className="text-xs">
              {Math.round(zoom * 100)}%
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterType} onValueChange={(value) => setFilterType(value as GraphNode['type'] | 'all')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="person">People</SelectItem>
              <SelectItem value="topic">Topics</SelectItem>
              <SelectItem value="decision">Decisions</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="artifact">Artifacts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex">
          {/* Graph visualization */}
          <div
            ref={containerRef}
            className={cn('relative overflow-hidden bg-muted/20', selectedNode ? 'w-2/3' : 'w-full')}
            style={{ height: isFullscreen ? '100vh' : '500px' }}
          >
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              role="img"
              aria-label="Knowledge graph visualization"
            >
              <title>Knowledge Graph</title>
              {/* Edges */}
              <g className="edges">
                {filteredEdges.map((edge) => {
                  const sourcePos = positions.get(edge.sourceNodeId);
                  const targetPos = positions.get(edge.targetNodeId);
                  if (!sourcePos || !targetPos) return null;

                  const isHighlighted =
                    selectedNode && (edge.sourceNodeId === selectedNode.id || edge.targetNodeId === selectedNode.id);

                  return (
                    <line
                      key={edge.id}
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke={isHighlighted ? '#6366f1' : '#d1d5db'}
                      strokeWidth={isHighlighted ? 2 : 1}
                      strokeOpacity={isHighlighted ? 1 : 0.5}
                    />
                  );
                })}
              </g>

              {/* Nodes */}
              <g className="nodes">
                {filteredNodes.map((node) => {
                  const pos = positions.get(node.id);
                  if (!pos) return null;

                  const colors = NODE_COLORS[node.type];
                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNode === node.id;
                  const isConnected = selectedNode && connectedNodes.some((n) => n.id === node.id);

                  const radius = isSelected ? 30 : isHovered ? 26 : 22;
                  const opacity = selectedNode && !isSelected && !isConnected ? 0.3 : 1;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{ cursor: 'pointer', opacity }}
                      onClick={() => handleNodeClick(node)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleNodeClick(node);
                        }
                      }}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${node.type}: ${node.label}`}
                    >
                      <circle
                        r={radius}
                        fill={colors.fill}
                        stroke={isSelected ? '#6366f1' : colors.stroke}
                        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.5}
                      />
                      {/* Icon in center */}
                      <foreignObject x={-8} y={-8} width={16} height={16} style={{ pointerEvents: 'none' }}>
                        <div className="flex items-center justify-center w-full h-full">
                          <NodeIcon type={node.type} className={cn('h-4 w-4', `text-[${colors.stroke}]`)} />
                        </div>
                      </foreignObject>
                      {/* Label */}
                      <text
                        y={radius + 14}
                        textAnchor="middle"
                        className="text-xs fill-foreground pointer-events-none"
                        style={{ fontSize: '11px' }}
                      >
                        {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border">
              <div className="text-xs font-medium mb-2">Node Types</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(NODE_COLORS).map(([type, colors]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{
                        backgroundColor: colors.fill,
                        borderColor: colors.stroke,
                      }}
                    />
                    <span className="text-xs capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="absolute top-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm border">
              <div className="text-xs text-muted-foreground">
                {filteredNodes.length} nodes • {filteredEdges.length} connections
              </div>
            </div>
          </div>

          {/* Details panel */}
          {selectedNode && (
            <div className="w-1/3 border-l">
              <ScrollArea className="h-[500px]">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: NODE_COLORS[selectedNode.type].fill,
                          borderColor: NODE_COLORS[selectedNode.type].stroke,
                          borderWidth: 2,
                        }}
                      >
                        <NodeIcon type={selectedNode.type} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{selectedNode.label}</h3>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {selectedNode.type}
                        </Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                      ×
                    </Button>
                  </div>

                  {/* Metadata */}
                  {selectedNode.metadata && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Details</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {Object.entries(selectedNode.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span className="font-medium text-foreground">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connected nodes */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Connected ({connectedNodes.length})</h4>
                    <div className="space-y-2">
                      {connectedNodes.map((node) => (
                        <button
                          type="button"
                          key={node.id}
                          onClick={() => handleNodeClick(node)}
                          className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors text-left"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: NODE_COLORS[node.type].fill,
                            }}
                          >
                            <NodeIcon type={node.type} className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{node.label}</div>
                            <div className="text-xs text-muted-foreground capitalize">{node.type}</div>
                          </div>
                        </button>
                      ))}
                      {connectedNodes.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">No connections found</div>
                      )}
                    </div>
                  </div>

                  {/* Actions for decision nodes */}
                  {selectedNode.type === 'decision' && (
                    <div className="mt-4 pt-4 border-t">
                      <Button className="w-full" onClick={() => onDecisionClick?.(selectedNode.id)}>
                        View Decision Details
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default KnowledgeExplorer;
