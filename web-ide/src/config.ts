export const workspaceFile = '/workspace.code-workspace'
export const workspacePath = "/workspace";
export const cppUri = workspacePath + "/test.cpp";

export const defaultProgram = `#include <iostream>

/*
    You can execute arbitrary C++ single-file programs
    with the cpp-exec command. This command will compile your program
    using clang19 with -fno-exceptions -std=c++23 -O1 flags, link it with lld
    and immediately execute it using the terminal stdin/stdout.
    
    The first compilation will be much slower since it requires
    loading and compiling clang.
    
    Currently available commands are cd, ls, clear, cpp-exec but many more will be added soon.
    It's recommended to use vscode's tree viewer for simple file management.
    Multi-header projects will be supported in the near future after a proper
    file system implementation is realised. Currently there are 3 different virtual filesystems
    which interact with one another through commands. You can explore all available headers
    by looking at /usr/include/wasm32-wasi/c++/v1 
    (note that you should manually change the vscode file mode to c++ for these headers
    as they won't be recognised since they are extension-less).
    
    Threading and networking will come at a later date.
*/

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`;