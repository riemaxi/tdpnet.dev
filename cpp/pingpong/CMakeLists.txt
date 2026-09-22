cmake_minimum_required(VERSION 3.14)
project(pingpong CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find system threading support required by ixwebsocket
find_package(Threads REQUIRED)

# Find packages provided by vcpkg
find_package(nlohmann_json CONFIG REQUIRED)
find_package(ixwebsocket CONFIG REQUIRED)

# Executable target
add_executable(app main.cpp)

# Link vcpkg & system targets
target_link_libraries(app PRIVATE 
    nlohmann_json::nlohmann_json 
    ixwebsocket::ixwebsocket
    Threads::Threads
)