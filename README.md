## This project is very much a work in progress but somehow it works (kind of).

There are a few things to consider in advance;
Newer LLVM versions behave nicely, I built everything with 19.1.5
Its best to use a self compiled wasi-sdk and hack together a workable sysroot. One of the main problems I encountered early on is getting clang's internal headers to play along nicely with stl.

# The current workflow for creating the sysroot is as follows;

Compile wasi-sdk from master, d94a133 appears to work fine, and then create a sysroot by combining;
1. `build/install/share/wasi-sysroot` 
2. `build/install/clang-resource-dir/lib/wasi` 
3. `build/install/lib/clang/19/include` 

"Combining" as in adding to the sysroot folder the following;
```
wasi-sysroot/lib/clang/19
    - include (stddef..)
    - lib/wasi/libclang_rt.builtins-wasm32 (yep nested lib folders)
```
Before compiling the wasm artifacts we first need to compile tblgen which may be achieved via;
```bash
cmake -G Ninja -S llvm -B build-host -DCMAKE_BUILD_TYPE=Release
cmake --build build-host --target llvm-tblgen
```
After that we can modify llvm's cmakelist by adding
```cmake
set_target_properties(lld PROPERTIES LINK_FLAGS "--preload-file=../../wasi-sysroot@/ -sNO_INVOKE_RUN -s STACK_SIZE=4MB -sEXIT_RUNTIME -s INITIAL_MEMORY=512MB -s MAXIMUM_MEMORY=2GB -s ALLOW_MEMORY_GROWTH=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain -sMODULARIZE -sEXPORT_ES6 -sWASM_BIGINT")
set_target_properties(clang PROPERTIES LINK_FLAGS "--preload-file=../../wasi-sysroot@/ -sNO_INVOKE_RUN -s STACK_SIZE=4MB -sEXIT_RUNTIME -s INITIAL_MEMORY=512MB -s MAXIMUM_MEMORY=2GB -s ALLOW_MEMORY_GROWTH=1 -sEXPORTED_RUNTIME_METHODS=FS,callMain -sMODULARIZE -sEXPORT_ES6 -sWASM_BIGINT")
```
The memory limits are definitely higher than necessary but for development purposes it is oftentimes beneficial to have this leeway. Adjusting the stack size is needed (???)
Then we can build the artifacts with;
```bash
emcmake cmake -G Ninja -S llvm -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX=install \
  -DCMAKE_CROSSCOMPILING=True \
  -DCMAKE_C_FLAGS="" \
  -DCMAKE_CXX_FLAGS="-Dwait4=__syscall_wait4 -O2" \
  -DLLVM_TARGET_ARCH=wasm32-emscripten \
  -DLLVM_DEFAULT_TARGET_TRIPLE=wasm32-wasi \
  -DLLVM_ENABLE_PROJECTS="clang;lld" \
  -DLLVM_TARGETS_TO_BUILD=WebAssembly \
  -DLLVM_ENABLE_THREADS=OFF \
  -DLLVM_TABLEGEN=$PWD/build-host/bin/llvm-tblgen\
  -DLLVM_ENABLE_PIC=OFF\
  -DLLVM_INCLUDE_UTILS=OFF \
  -DLLVM_ENABLE_OCAMLDOC=OFF\
  -DLLVM_ENABLE_BACKTRACES=OFF\
  -DLLVM_INCLUDE_TESTS=OFF \
  -DLLVM_INCLUDE_EXAMPLES=OFF \
  -DLLVM_INCLUDE_BENCHMARKS=OFF \
  -DLLVM_CCACHE_BUILD=ON \
  -DLLVM_PARALLEL_LINK_JOBS=12
cmake --build build
```
I would like to thank https://github.com/soedirgo/llvm-wasm/issues/4 and llvm-wasm for providing me with some boilerplate and useful knowledge.