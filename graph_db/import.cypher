// Load the spaceflight subcellular atlas into Neo4j.
// Place nodes.csv and edges.csv in the DBMS import/ folder, then run:
LOAD CSV WITH HEADERS FROM 'file:///nodes.csv' AS r
CALL apoc.create.node([r.`label:LABEL`], {id:r.`id:ID`, name:r.name}) YIELD node RETURN count(*);
CREATE INDEX IF NOT EXISTS FOR (n:Gene) ON (n.id);
LOAD CSV WITH HEADERS FROM 'file:///edges.csv' AS r
MATCH (a {id:r.`:START_ID`}), (b {id:r.`:END_ID`})
CALL apoc.create.relationship(a, r.`:TYPE`, {log2FC:toFloat(r.`log2FC:float`), padj:toFloat(r.`padj:float`)}, b)
YIELD rel RETURN count(*);
// Example: which compartments do a pathway's spaceflight-responsive genes sit in?
// MATCH (p:Pathway)<-[:IN_PATHWAY]-(g:Gene)-[:LOCATED_IN]->(c:Compartment)
// RETURN p.name, c.name, count(DISTINCT g) ORDER BY count(DISTINCT g) DESC;
