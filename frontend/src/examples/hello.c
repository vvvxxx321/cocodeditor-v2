#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Define a simple structure
typedef struct {
    char name[50];
    int age;
} Person;

// Function prototype
void greet(Person p);

int main() {
    // Variable declaration
    int numbers[] = {1, 2, 3, 4, 5};
    int sum = 0;
    int i;
    
    // Loop through array
    for (i = 0; i < 5; i++) {
        sum += numbers[i];
        printf("Current number: %d, Running sum: %d\n", numbers[i], sum);
    }
    
    // Use our structure
    Person person;
    strcpy(person.name, "Alice");
    person.age = 30;
    
    // Call function
    greet(person);
    
    // Dynamic memory allocation
    int* dynamicArray = (int*)malloc(5 * sizeof(int));
    if (dynamicArray == NULL) {
        printf("Memory allocation failed\n");
        return 1;
    }
    
    // Use malloc'd memory
    for (i = 0; i < 5; i++) {
        dynamicArray[i] = i * 10;
        printf("dynamicArray[%d] = %d\n", i, dynamicArray[i]);
    }
    
    // Free allocated memory
    free(dynamicArray);
    
    return 0;
}

// Function implementation
void greet(Person p) {
    printf("Hello, %s! You are %d years old.\n", p.name, p.age);
} 