import { T, Var } from 'gt-next';
export default function Home() {
  const temp = 'Hello World!';

  const test1 = (
    <T id='app._locale_.page.0'>
      <div>Hello World!</div>
    </T>
  );
  const test2 = (
    <T id='app._locale_.page.1'>
      <p>Hello World!</p>
    </T>
  );
  const test3 = (
    <T id='app._locale_.page.3'>
      <p>
        <Var>{true && <T id='app._locale_.page.2'>{'true'}</T>}</Var>
      </p>
    </T>
  );
  const test4 = <div>{test2}</div>;
  const test5 = (
    <T id='app._locale_.page.6'>
      <div>
        <Var>
          {true ? (
            <T id='app._locale_.page.4'>{'true'}</T>
          ) : (
            <T id='app._locale_.page.5'>{'false'}</T>
          )}
        </Var>
      </div>
    </T>
  );
  const test6 = (
    <T id='app._locale_.page.8'>
      <div>
        <Var>
          {true ? (
            <T id='app._locale_.page.7'>
              <div>true</div>
            </T>
          ) : (
            <div>
              <Var>{temp}</Var>
            </div>
          )}
        </Var>
      </div>
    </T>
  );
  return (
    <T id='app._locale_.page.38'>
      <div>
        <p>Hello World!</p>
        <p>{'Hello World!'}</p>
        <p>{'Hello,' + ' World!'}</p>
        <div>
          <p>Hello World!</p>
        </div>
        <p>{3 + 3}</p>
        <p>{3 + '3'}</p>
        <p>{3}</p>
        <p>
          <Var>{`${3}`}</Var>
        </p>
        <p>
          <Var>{`${temp}`}</Var>
        </p>
        <p>
          <Var>{`${temp}` + 3}</Var>
        </p>
        <p>{`3`}</p>
        <p>{`3` + 3}</p>
        <p>
          <Var>{true && <T id='app._locale_.page.20'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>{true || <T id='app._locale_.page.21'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>
            {true ? (
              <T id='app._locale_.page.22'>{'true'}</T>
            ) : (
              <T id='app._locale_.page.23'>{'false'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='app._locale_.page.24'>{'true'}</T>
              ) : (
                <T id='app._locale_.page.25'>{'false'}</T>
              )
            ) : (
              <T id='app._locale_.page.26'>{'false'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='app._locale_.page.27'>{'true'}</T>
              ) : (
                <T id='app._locale_.page.28'>{'false'}</T>
              )
            ) : true ? (
              <T id='app._locale_.page.29'>{'true'}</T>
            ) : (
              <T id='app._locale_.page.30'>{'false'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true && (
              <T id='app._locale_.page.9'>
                <p>true</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true || (
              <T id='app._locale_.page.10'>
                <p>true</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              <T id='app._locale_.page.11'>
                <p>true</p>
              </T>
            ) : (
              <T id='app._locale_.page.12'>
                <p>false</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='app._locale_.page.13'>
                  <p>true</p>
                </T>
              ) : (
                <T id='app._locale_.page.14'>
                  <p>false</p>
                </T>
              )
            ) : (
              <T id='app._locale_.page.15'>
                <p>false</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {true ? (
              true ? (
                <T id='app._locale_.page.16'>
                  <p>true</p>
                </T>
              ) : (
                <T id='app._locale_.page.17'>
                  <p>false</p>
                </T>
              )
            ) : true ? (
              <T id='app._locale_.page.18'>
                <p>true</p>
              </T>
            ) : (
              <T id='app._locale_.page.19'>
                <p>false</p>
              </T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {<T id='app._locale_.page.31'>{'hello'}</T> || (
              <T id='app._locale_.page.32'>{'true'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>
            {<T id='app._locale_.page.33'>{'hello'}</T> ?? (
              <T id='app._locale_.page.34'>{'true'}</T>
            )}
          </Var>
        </p>
        <p>
          <Var>{'hello' && <T id='app._locale_.page.35'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>{'hello' && <T id='app._locale_.page.36'>{'true'}</T>}</Var>
        </p>
        <p>
          <Var>{'hello' && <T id='app._locale_.page.37'>{'true'}</T>}</Var>
        </p>
      </div>
    </T>
  );
}
