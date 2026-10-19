document.addEventListener("DOMContentLoaded", () => {
    const storageKey = "daily-task-manager-tasks";
    const taskForm = document.getElementById("task-form");
    const taskInput = document.getElementById("text-area");
    const taskList = document.getElementById("task-list");
    const todoContainer = document.querySelector(".todo-container");
    const emptyState = document.getElementById("empty-state");
    const emptyImage = document.querySelector(".empty-image");
    const currentDate = document.getElementById("current-date");
    const datePicker = document.getElementById("date-picker");
    const previousDateButton = document.getElementById("previous-date");
    const nextDateButton = document.getElementById("next-date");
    const dateShortcutButtons = document.querySelectorAll("[data-date-shortcut]");
    const formMessage = document.getElementById("form-message");

    const toDateKey = date => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const todayKey = toDateKey(new Date());
    let selectedDate = todayKey;
    let showAllTasks = false;

    const parseDateKey = dateKey => {
        const [year, month, day] = dateKey.split("-").map(Number);
        return new Date(year, month - 1, day);
    };

    const formatDate = dateKey => new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    }).format(parseDateKey(dateKey));

    const getDateOffset = dateKey => Math.round((parseDateKey(dateKey) - parseDateKey(todayKey)) / 86400000);

    const updateDateControls = () => {
        datePicker.value = selectedDate;
        datePicker.disabled = showAllTasks;
        previousDateButton.disabled = showAllTasks;
        nextDateButton.disabled = showAllTasks;

        if (showAllTasks) {
            currentDate.textContent = "All tasks";
        } else {
            const offset = getDateOffset(selectedDate);
            const relativeLabel = offset === 0 ? "Today" : offset === -1 ? "Yesterday" : offset === 1 ? "Tomorrow" : "";
            currentDate.textContent = relativeLabel ? `${relativeLabel} · ${formatDate(selectedDate)}` : formatDate(selectedDate);
        }

        dateShortcutButtons.forEach(button => {
            const shortcut = button.dataset.dateShortcut;
            const active = shortcut === "all"
                ? showAllTasks
                : !showAllTasks && getDateOffset(selectedDate) === ({ yesterday: -1, today: 0, tomorrow: 1 })[shortcut];
            button.setAttribute("aria-pressed", String(active));
        });
    };

    const loadTasks = () => {
        try {
            const savedTasks = JSON.parse(localStorage.getItem(storageKey) || "[]");
            return Array.isArray(savedTasks)
                ? savedTasks
                    .filter(task => task && typeof task.id === "string" && typeof task.text === "string" && typeof task.completed === "boolean")
                    .map(task => ({ ...task, date: typeof task.date === "string" ? task.date : todayKey }))
                : [];
        } catch {
            return [];
        }
    };

    let tasks = loadTasks();

    const saveTasks = () => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(tasks.map(({ id, text, completed, date }) => ({ id, text, completed, date }))));
        } catch {
            formMessage.textContent = "Tasks are available for this session, but could not be saved.";
        }
    };

    const makeButton = (label, iconClass, className) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `task-action ${className}`;
        button.setAttribute("aria-label", label);
        button.title = label;
        const icon = document.createElement("i");
        icon.className = `fa-solid ${iconClass}`;
        icon.setAttribute("aria-hidden", "true");
        button.append(icon);
        return button;
    };

    const celebrateTask = checkbox => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const bounds = checkbox.getBoundingClientRect();
        const burst = document.createElement("div");
        const colors = ["#f6c85f", "#70c1b3", "#f28482", "#8ecae6", "#fff1c1"];
        burst.className = "confetti-burst";
        burst.setAttribute("aria-hidden", "true");
        burst.style.left = `${bounds.left + bounds.width / 2}px`;
        burst.style.top = `${bounds.top + bounds.height / 2}px`;

        for (let index = 0; index < 24; index += 1) {
            const angle = (Math.PI * 2 * index) / 24 + Math.random() * 0.2;
            const distance = 36 + Math.random() * 68;
            const piece = document.createElement("span");
            piece.className = "confetti-piece";
            piece.style.setProperty("--confetti-color", colors[index % colors.length]);
            piece.style.setProperty("--confetti-x", `${Math.cos(angle) * distance}px`);
            piece.style.setProperty("--confetti-y", `${Math.sin(angle) * distance - 24}px`);
            piece.style.setProperty("--confetti-turn", `${Math.random() * 720 - 360}deg`);
            piece.style.animationDelay = `${Math.random() * 90}ms`;
            burst.append(piece);
        }

        document.body.append(burst);
        window.setTimeout(() => burst.remove(), 1100);
    };

    const renderTasks = () => {
        taskList.replaceChildren();
        const visibleTasks = tasks.filter(task => showAllTasks || task.date === selectedDate);
        const hasTasks = visibleTasks.length > 0;
        taskList.hidden = !hasTasks;
        emptyState.hidden = hasTasks;
        emptyImage.hidden = hasTasks;
        todoContainer.classList.toggle("has-tasks", hasTasks);

        visibleTasks.forEach(task => {
            const item = document.createElement("li");
            item.className = "task-item";
            item.dataset.taskId = task.id;
            if (task.completed) item.classList.add("is-complete");

            if (task.editing) {
                const editor = document.createElement("input");
                editor.className = "task-edit-input";
                editor.type = "text";
                editor.value = task.text;
                editor.maxLength = 120;
                editor.setAttribute("aria-label", `Edit task: ${task.text}`);

                const actions = document.createElement("div");
                actions.className = "task-actions";
                const saveButton = makeButton("Save changes", "fa-check", "save-task");
                const cancelButton = makeButton("Cancel editing", "fa-xmark", "cancel-edit");
                const saveEdit = () => {
                    const updatedText = editor.value.trim();
                    if (!updatedText) {
                        editor.focus();
                        return;
                    }
                    formMessage.textContent = "";
                    task.text = updatedText;
                    delete task.editing;
                    saveTasks();
                    renderTasks();
                };
                saveButton.addEventListener("click", saveEdit);
                cancelButton.addEventListener("click", () => {
                    formMessage.textContent = "";
                    delete task.editing;
                    renderTasks();
                });
                editor.addEventListener("keydown", event => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        saveEdit();
                    } else if (event.key === "Escape") {
                        delete task.editing;
                        renderTasks();
                    }
                });
                actions.append(saveButton, cancelButton);
                item.append(editor, actions);
                taskList.append(item);
                editor.focus();
                editor.select();
                return;
            }

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "task-checkbox";
            checkbox.checked = task.completed;
            checkbox.setAttribute("aria-label", `Mark ${task.text} ${task.completed ? "incomplete" : "complete"}`);
            checkbox.addEventListener("change", () => {
                formMessage.textContent = "";
                task.completed = checkbox.checked;
                if (task.completed) celebrateTask(checkbox);
                saveTasks();
                renderTasks();
            });

            const taskText = document.createElement("button");
            taskText.type = "button";
            taskText.className = "task-text";
            taskText.textContent = task.text;
            taskText.setAttribute("aria-label", `Edit task: ${task.text}`);
            taskText.title = "Edit task";

            const actions = document.createElement("div");
            actions.className = "task-actions";
            const editButton = makeButton("Edit task", "fa-pen-to-square", "edit-task");
            const deleteButton = makeButton("Delete task", "fa-trash", "delete-task");
            const startEditing = () => {
                task.editing = true;
                renderTasks();
            };
            taskText.addEventListener("click", startEditing);
            editButton.addEventListener("click", startEditing);
            deleteButton.addEventListener("click", () => {
                item.classList.add("is-removing");
                formMessage.textContent = "";
                let removalFinished = false;
                const removeTask = () => {
                    if (removalFinished) return;
                    removalFinished = true;
                    tasks = tasks.filter(savedTask => savedTask.id !== task.id);
                    saveTasks();
                    renderTasks();
                };
                item.addEventListener("animationend", removeTask, { once: true });
                window.setTimeout(removeTask, 250);
            });

            item.append(checkbox, taskText, actions);
            actions.append(editButton, deleteButton);
            taskList.append(item);
        });
    };

    const chooseDate = dateKey => {
        if (!dateKey) return;
        tasks.forEach(task => delete task.editing);
        showAllTasks = false;
        selectedDate = dateKey;
        formMessage.textContent = "";
        updateDateControls();
        renderTasks();
    };

    const moveDate = offset => {
        const date = parseDateKey(selectedDate);
        date.setDate(date.getDate() + offset);
        chooseDate(toDateKey(date));
    };

    const selectShortcut = shortcut => {
        if (shortcut === "all") {
            showAllTasks = true;
            tasks.forEach(task => delete task.editing);
            formMessage.textContent = "";
            updateDateControls();
            renderTasks();
            return;
        }

        const offset = ({ yesterday: -1, today: 0, tomorrow: 1 })[shortcut];
        const date = parseDateKey(todayKey);
        date.setDate(date.getDate() + offset);
        chooseDate(toDateKey(date));
    };

    previousDateButton.addEventListener("click", () => moveDate(-1));
    nextDateButton.addEventListener("click", () => moveDate(1));
    datePicker.addEventListener("change", () => chooseDate(datePicker.value));
    dateShortcutButtons.forEach(button => {
        button.addEventListener("click", () => selectShortcut(button.dataset.dateShortcut));
    });

    taskForm.addEventListener("submit", event => {
        event.preventDefault();
        const text = taskInput.value.trim();
        if (!text) {
            formMessage.textContent = "Type a task before adding it.";
            taskInput.focus();
            return;
        }

        formMessage.textContent = "";
        tasks.unshift({
            id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            text,
            completed: false,
            date: showAllTasks ? todayKey : selectedDate
        });
        saveTasks();
        renderTasks();
        taskInput.value = "";
        taskInput.focus();
    });

    taskInput.addEventListener("input", () => {
        formMessage.textContent = "";
    });

    updateDateControls();
    renderTasks();
});
