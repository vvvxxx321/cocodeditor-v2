#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Function to greet
void greet(const char* name) {
    printf("Hello, %s!\n", name);
}

// Structure definition
typedef struct {
    char name[50];
    int age;
} Person;

// Function to display person info
void display_person(const Person* person) {
    printf("Name: %s, Age: %d\n", person->name, person->age);
}

// Main function
int main() {
    // Basic output
    printf("C Programming Example\n");
    
    // Function call
    greet("World");
    
    // Variables and arithmetic
    int a = 10;
    int b = 20;
    printf("Sum: %d\n", a + b);
    
    // Using arrays
    int numbers[5] = {5, 2, 8, 1, 3};
    printf("Numbers: ");
    for (int i = 0; i < 5; i++) {
        printf("%d ", numbers[i]);
    }
    printf("\n");
    
    // Using structures
    Person person1;
    strcpy(person1.name, "Alice");
    person1.age = 30;
    
    Person person2;
    strcpy(person2.name, "Bob");
    person2.age = 25;
    
    // Passing structure to function
    display_person(&person1);
    display_person(&person2);
    
    // Dynamic memory allocation
    int* dynamicArray = (int*)malloc(3 * sizeof(int));
    if (dynamicArray != NULL) {
        dynamicArray[0] = 100;
        dynamicArray[1] = 200;
        dynamicArray[2] = 300;
        
        printf("Dynamic array: %d %d %d\n", 
               dynamicArray[0], dynamicArray[1], dynamicArray[2]);
        
        // Free allocated memory
        free(dynamicArray);
    }
    
    return 0;
} 