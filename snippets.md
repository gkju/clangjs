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


```c++
#include <iostream>
#include <vector>
#include <algorithm>
#include <cstdlib>
int main() {
std::vector<int> v = {3,2,4,1};
std::sort(v.begin(),v.end());
for (auto& e : v) {
    std::cout << e << " " << std::rand() << "\n";
}
}
```

```c++
#include <iostream>
#include <vector>
#include <algorithm>
#include <cstdlib>
#include <set>
int main() {
std::vector<int> v = {3,2,4,1};
std::sort(v.begin(),v.end());
for (auto& e : v) {
    std::cout << e << " " << std::rand() << "\n";
}
std::set<int> gigaset = {2,3,4,5,6,7,8,9,10,-1,-2,-3,-4,-5,-6,-7,-8};
for (auto& x : gigaset) {
   std::cout << x << "\n";
}
}
```