// components/ProcessGraph.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  label: string;
}

interface Link {
  source: string;
  target: string;
}

interface ProcessGraphProps {
  nodes: Node[];
  links: Link[];
}

const ProcessGraph: React.FC<ProcessGraphProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear existing SVG content

    const width = 800;
    const height = 600;

    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    const node = svg
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', 20)
      .attr('fill', '#1f77b4')
      .call(
        d3
          .drag<SVGCircleElement, Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const labels = svg
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => d.label)
      .attr('font-size', 12)
      .attr('dx', -20)
      .attr('dy', 4);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      labels.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });

    return () => simulation.stop();
  }, [nodes, links]);

  return <svg ref={svgRef} width={800} height={600} />;
};

export default ProcessGraph;
