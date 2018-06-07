Node-OMP
==================================

Node-OMP is an Openvas Manager Protocol client library. This project is a work
in progress and not all commands have been implemented. The implementation
is very simple just converting JSON options to XML and passing the command
onto the server. All functions return a JavaScript Promise.

If you have any concerns or suggestions please feel free to create an issue
in the issue tracker. If you have found a bug that needs addressed and are
capable of fixing it, go ahead fixing the bug and submit a pull request.

### Implemented
- authenticate
- get_targets
- create_target
- create_agent
- create_group
- create_permission
