#include <algorithm>
#include <complex>
#include <iostream>
#include <vector>
#include <cmath>
#include <numbers>
#include <exception>
#include <chrono>
#include <string>

using cdouble_t = std::complex<double>;

void fft(std::vector<cdouble_t> &vec, bool invert) {
    int n = vec.size();
    if(n == 1) {
        return;
    }

    std::vector<cdouble_t> even(n / 2), odd(n / 2);
    for(int i = 0; 2 * i + 1 < n; i++) {
        even[i] = vec[2 * i];
        odd[i] = vec[2 * i + 1];
    }
    fft(even, invert);
    fft(odd, invert);

    double arg = 2 * std::numbers::pi / n * (invert ? -1 : 1);
    cdouble_t nthRoot(cos(arg), sin(arg)), currentRoot(1, 0);
    for(int i = 0; 2 * i < n; i++) {
        cdouble_t coeff = currentRoot * odd[i];
        vec[i] = even[i] + coeff;
        vec[i + n / 2] = even[i] - coeff;
        if(invert) {
            vec[i] /= 2;
            vec[i + n / 2] /= 2;
        }
        currentRoot *= nthRoot;
    }
}

void reVecToCompVec(std::vector<cdouble_t> &out, const std::vector<int32_t> &in) {
    out.reserve(in.size());
    out.clear();

    for(int i : in) {
        out.push_back(cdouble_t(i, 0));
    }
}

void padVec(std::vector<cdouble_t> &vec, int n) {
    vec.reserve(n);
    while(vec.size() < n) {
        vec.push_back(cdouble_t(0, 0));
    }
}

std::vector<int32_t> fastPolyMul(const std::vector<int32_t> &a, const std::vector<int32_t> &b) {
    int resultSize = a.size() + b.size() - 1;
    std::vector<cdouble_t> apad(a.size()), bpad(b.size());
    reVecToCompVec(apad, a);
    reVecToCompVec(bpad, b);

    int n = 1;
    while(n < a.size() + b.size()) {
        n *= 2;
    }
    padVec(apad, n);
    padVec(bpad, n);

    fft(apad, false);
    fft(bpad, false);
    for(int i = 0; i < n; i++) {
        apad[i] *= bpad[i];
    }
    fft(apad, true);

    std::vector<int32_t> result(resultSize);
    for(int i = 0; i < resultSize; i++) {
        result[i] = round(apad[i].real());
    }

    return result;
}

void memberwiseAdd(std::vector<int32_t> &target, std::vector<int32_t> &input) {
    if(target.size() < input.size()) {
        target.reserve(input.size());
        while(target.size() < input.size()) {
            target.push_back(0);
        }
    }

    for(int i = 0; i < input.size(); i++) {
        target[i] += input[i];
    }
}

std::vector<int32_t> generatePartitionPoly(int num, int limit) {
    std::vector<int32_t> res(num * limit + 1);
    for(int i = 0; i <= num * limit; ++i) {
        res[i] = i % num == 0 ? 1 : 0;
    }

    return res;
}

std::vector<int32_t> restrictedPartitions(std::vector<int32_t> &numbers, std::vector<int32_t> &maxCount) {
    if(maxCount.size() < numbers.size()) {
        throw std::invalid_argument("Wektor maxCount powinien zawierac ile razy mozna uzyc kazda z liczb");
    }
    // zero mozna uzyskac biorac kazda liczbe zero razy
    std::vector<int32_t> result = { 1 };

    for(int i = 0; i < numbers.size(); ++i) {
        result = fastPolyMul(result, std::move(generatePartitionPoly(numbers[i], maxCount[i])));
    }

    return result;
}

int main() {
    std::vector<int32_t> nums, maxCount;
    for(int i = 1; i < 42; i++) {
        nums.push_back(i);
        maxCount.push_back(42);
    }
    auto start = std::chrono::high_resolution_clock::now();
    auto res = restrictedPartitions(nums, maxCount);
    auto end = std::chrono::high_resolution_clock::now();
    std::cout << "Time taken: " << std::chrono::duration_cast<std::chrono::milliseconds>(end - start).count() << " ms\n";
    std::cout << "[ ";
    for(int i = 0; i < std::min(res.size(), (size_t) 30); i++) {
        std::cout << res[i] << " ";
    }
    std::cout << "]";
}