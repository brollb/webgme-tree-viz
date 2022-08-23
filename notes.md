# Notes
- [ ] Define a transformation for an example node

- [ ] Update the viz dynamically when the transformation changes

- [ ] Update the viz dynamically when the nodes change

- [ ] How to represent edits to the model?
    - for now, they can be always there...
    - in the future, it would be cool if we could add items to the context menu

- [ ] Set the colors of nodes

- [ ] lazily load the nodes?
    - it seems the territory depth can probably be inferred from the transformation
    - how should the default transformation work??
        - Can it lazily
    - Can a transformation lazily load nodes on click, too?
        - how exactly would this work?

- [ ] How should we represent transient visualizer state? eg, node status (open/closed)
    - some of these actions
    - Can we represent the territory somehow? Maybe we already are by using "child of"?
    - for the short term, we will load the entire graph and just hide the UI elements

- [ ] Update the visualizer info to use this "visualizers" set
    - First, check the visualizer registry value (these will use defaults)
    - Then, check the visualizers set and get the visualizers from there
        - name
        - engine
        - configure?
        - we need an extension to the visualizer API for the configuration node ID

## Done
- [x] create the metamodel for the graph viz
    - graph
        - title/name
    - node
        - children (node)
        - attributes
            - name
            - color

