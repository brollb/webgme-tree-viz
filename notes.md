# Notes
- [ ] How to represent edits to the model?
    - for now, they can be always there...
    - in the future, it would be cool if we could add items to the context menu

- [ ] debug undefined child nodes
    - why are they being created?

- [ ] add on-drop handler

- [ ] is there a better way to define the metamodel for the visualizer which we can then import?
    - EMF?
    - the problem rn is that there is a disconnect btwn the implementations for actions and the model
        - ie, it would be nice to have a single source of truth

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

- [x] add the SetAttribute action
    - why don't we see the node for the attribute?
        - is it being created?
        - @id:0_21
        - yes but not found at the end...
        - it was missing the "child of" connection

- [x] Define a transformation for an example node

- [x] Update the viz dynamically when the transformation changes

- [x] Update the viz dynamically when the nodes change...

- [x] Set the colors of nodes

- [x] setAttribute only works the first time...
    - cannot set depth in territory to infinity

