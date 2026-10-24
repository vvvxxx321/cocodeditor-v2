#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

// Simple function to greet someone
std::string greet(const std::string& name) {
    return "Hello, " + name + "!";
}

// A basic class example
class Person {
private:
    std::string name;
    int age;
    
public:
    // Constructor
    Person(const std::string& name, int age) : name(name), age(age) {}
    
    // Getters
    std::string getName() const { return name; }
    int getAge() const { return age; }
    
    // Method to display info
    void displayInfo() const {
        std::cout << "Name: " << name << ", Age: " << age << std::endl;
    }
};

int main() {
    // Basic output
    std::cout << greet("World") << std::endl;
    
    // Using variables
    int num1 = 10;
    int num2 = 20;
    std::cout << "Sum: " << num1 + num2 << std::endl;
    
    // Using vectors
    std::vector<int> numbers = {5, 2, 8, 1, 3};
    
    // Using algorithms
    std::sort(numbers.begin(), numbers.end());
    
    std::cout << "Sorted numbers: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
    
    // Using objects
    Person alice("Alice", 30);
    Person bob("Bob", 25);
    
    alice.displayInfo();
    bob.displayInfo();
    
    return 0;
} 