let data = {
  userName: "Ryan",
};

export async function getUserName() {
  await new Promise(resolve => setTimeout(resolve, 200));
  return data.userName;
}

export async function setUserName(name: string) {
  data.userName = name;
}
