## this outlines the logic for when workspaces and sections are accessible by users

## Workspace/Tab access logic
- Master Admins can always see and eidt everything
- For standard users:
- A workspace/tab that is not set to "Add to the Catalog" will be visible only for that user who created it.  no other user can see it, and it wont appear in the workspace access matrix
- when a workspace/tab is added to catalog:
    - it will show in the workspace grid, and admins can manage them completely
    - it will show in the permissions matrix, with a in catalog button selected.  deselecting will remove from catalog and that matrix > this needs a confirmation since it cant be added back without teh original user doing so
            - workspaces for each group can either have owner (can assign access), edit (can edit the worskpace), view, or not shared
        - workspaces for each user can either have owner, edit, view, inherit, or not shared
            - if inherit is selected, the user adopts the permissions of the group it belongs to automatically.  that also means that as soon as the group permissions change, the inherited users also change
            - new users are set to inherit all workspaces by default.  
        - if the group permissions are changed, a power button shows which Automatically changes all the users to inherit in that group
    - it will show in the push matrix, witha push to all button
        - a pushed workspace means it shows for that user
        - a pushed workspace can also be locked, which means they cannot be removed for that user
        - whenever a workspace is pushed to a user, the permissions matrix should auto-update with a "push" icon next to it and access is set to viewer at minimum
        - same applies for a group - if a group has a workspace pushed to it, then all users in that group will have the workspace pushed to them, and the permissions matrix should auto-update with a "push" icon next to it and access is set to viewer at minimum
- a workspace will appear in the users catalog in the following scenarios
    1) it is added to the catalog
    2) it is either
        a) pushed to the user, either individually or as part of a group
        b) the user has view, edit, or owner access to the workspace in the permissions matrix
- imported workspaces are never added to catalog

## Section access logic
- 