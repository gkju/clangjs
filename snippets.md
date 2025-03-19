```cpp
// Problematic
#include <iostream> // #include <vector>

```



```c
#include <stdio.h>

//int fib(int n) {
//   if (n==0 || n == -1) return 1;
//   return fib(n-1)+fib(n-2);
//}

int fib(int n) {
   int a = 1, b = 1;

   int res = b;
   for (int i = 2; i < n; ++i) {
      int c = b+a;
      a=b;
      b=c;
      res=c;
   }
   return res;
}

int main() {
   printf("TEST1233 %d", fib(120));
}
```